const express = require("express");
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { handleChatMessage, processUploadedFile, resetConversation, getConversationStats } = require("../services/rhAssistant");
const NodeCache = require('node-cache');
const { v4: uuidv4 } = require('uuid');

// Cache pour les résultats fréquents
const queryCache = new NodeCache({ stdTTL: 1800 }); // 30 minutes
const sessionCache = new NodeCache({ stdTTL: 3600 }); // 1 heure pour les sessions

// Rate limiting ajusté
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Augmenté pour une meilleure UX
  message: {
    error: "Trop de requêtes. Veuillez patienter avant de réessayer.",
    retryAfter: Math.ceil(15 * 60 / 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Utiliser l'IP + session pour un rate limiting plus intelligent
    return `${req.ip}-${req.body?.userId || 'anonymous'}`;
  }
});

// Validation des entrées améliorée
const validateChatInput = [
  body('message')
    .optional()
    .isLength({ min: 0, max: 2000 })
    .withMessage('Le message ne peut pas dépasser 2000 caractères')
    .trim(),
  body('userId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('ID utilisateur invalide')
    .trim(),
  body('context')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Le contexte ne peut pas dépasser 500 caractères')
    .trim(),
  body('responseFormat')
    .optional()
    .isIn(['detailed', 'concise', 'bullets'])
    .withMessage('Format de réponse invalide'),
  body('sessionId')
    .optional()
    .isUUID()
    .withMessage('ID de session invalide')
];

// Types de fichiers supportés avec leurs extensions
const SUPPORTED_FILE_TYPES = {
  'pdf': ['application/pdf'],
  'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  'doc': ['application/msword'],
  'txt': ['text/plain'],
  'jpeg': ['image/jpeg'],
  'jpg': ['image/jpeg', 'image/jpg'],
  'png': ['image/png'],
  'webp': ['image/webp'],
  'gif': ['image/gif']
};

// Configuration des types MIME acceptés
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
];

// Middleware pour générer des IDs de requête
router.use((req, res, next) => {
  req.requestId = uuidv4();
  next();
});

// Validation des fichiers uploadés
function validateFile(file) {
  const errors = [];
  
  if (!file || !file.name || !file.data) {
    errors.push('Fichier invalide ou corrompu');
    return errors;
  }
  
  // Vérification extension
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  if (!fileExt || !SUPPORTED_FILE_TYPES[fileExt]) {
    errors.push(`Type de fichier non supporté: .${fileExt || 'inconnu'}`);
  }
  
  // Vérification MIME type si disponible
  if (file.mimetype && !ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
    errors.push(`Type MIME non supporté: ${file.mimetype}`);
  }
  
  // Vérification taille générale
  if (file.size > 20 * 1024 * 1024) { // 20MB max général
    errors.push('Fichier trop volumineux (max 20MB)');
  }
  
  // Vérification nom de fichier
  if (file.name.length > 255) {
    errors.push('Nom de fichier trop long');
  }
  
  return errors;
}

// Fonction de traitement des fichiers avec validation robuste

async function processFile(file) {
  if (!file) return null;
  
  console.log(`📎 Traitement du fichier`);
  
  const startTime = Date.now();
  
  try {
    // Validation préalable
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      return {
        fileName: file?.name || 'Fichier inconnu',
        error: validationErrors.join(', '),
        metadata: {
          status: 'validation_error',
          processingTime: Date.now() - startTime
        }
      };
    }
    
    console.log(`🔄 Traitement de ${file.name} (${file.size} bytes)...`);
    
    // Utiliser la fonction du service chatbotService
    const result = await processUploadedFile(file.data, file.name);
    
    if (result) {
      return {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.mimetype,
        processingTime: Date.now() - startTime,
        content: result.extractedText,
        metadata: {
          ...result,
          status: 'success'
        }
      };
      
      console.log(`✅ Fichier traité: ${file.name} en ${Date.now() - startTime}ms`);
    } else {
      return {
        fileName: file.name,
        fileSize: file.size,
        error: 'Échec du traitement du fichier',
        processingTime: Date.now() - startTime,
        metadata: {
          status: 'processing_error'
        }
      };
    }
    
  } catch (error) {
    console.error(`❌ Échec traitement ${file.name}:`, error);
    return {
      fileName: file.name,
      fileSize: file.size,
      error: `Erreur de traitement: ${error.message}`,
      processingTime: Date.now() - startTime,
      metadata: {
        status: 'processing_error',
        errorDetails: error.message
      }
    };
  }
}




async function processFiles(files) {
  if (!files || files.length === 0) return [];
  
  const results = [];
  const maxFiles = Math.min(files.length, 5); // Maximum 5 fichiers
  
  console.log(`📎 Traitement de ${maxFiles} fichier(s)...`);
  
  for (let i = 0; i < maxFiles; i++) {
    const file = files[i];
    const startTime = Date.now();
    
    try {
      // Validation préalable
      const validationErrors = validateFile(file);
      if (validationErrors.length > 0) {
        results.push({
          fileName: file?.name || 'Fichier inconnu',
          error: validationErrors.join(', '),
          metadata: {
            status: 'validation_error',
            processingTime: Date.now() - startTime
          }
        });
        continue;
      }
      
      console.log(`🔄 Traitement de ${file.name} (${file.size} bytes)...`);
      
      // Utiliser la fonction du service chatbotService
      const result = await processUploadedFile(file.data, file.name);
      
      if (result) {
        results.push({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.mimetype,
          processingTime: Date.now() - startTime,
          content: result.extractedText,
          metadata: {
            ...result,
            status: 'success'
          }
        });
        
        console.log(`✅ Fichier traité: ${file.name} en ${Date.now() - startTime}ms`);
      } else {
        results.push({
          fileName: file.name,
          fileSize: file.size,
          error: 'Échec du traitement du fichier',
          processingTime: Date.now() - startTime,
          metadata: {
            status: 'processing_error'
          }
        });
      }
      
    } catch (error) {
      console.error(`❌ Échec traitement ${file.name}:`, error);
      results.push({
        fileName: file.name,
        fileSize: file.size,
        error: `Erreur de traitement: ${error.message}`,
        processingTime: Date.now() - startTime,
        metadata: {
          status: 'processing_error',
          errorDetails: error.message
        }
      });
    }
  }
  
  return results;
}

// Route principale de chat avec système intelligent
router.post('/', chatLimiter, validateChatInput, async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId;
  
  try {
    // Validation des entrées
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Données invalides",
        details: errors.array(),
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    const { 
      message = '', 
      userId = `anonymous-${Date.now()}`, 
      context = '', 
      responseFormat = 'detailed',
      sessionId = uuidv4()
    } = req.body;
    
    console.log(`🎯 Nouvelle requête [${requestId}] de ${userId}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

    // Traitement des fichiers si présents
    let fileResults = [];
    let uploadedFile = null;
    console.log('=== DEBUGGING FILE STRUCTURE ===');
  
  // Check if req.files exists
  console.log('req.files exists:', !!req.files);
  console.log('req.files type:', typeof req.files);
  console.log('req.files:', req.files);
  
  if (req.files) {
    console.log('Keys in req.files:', Object.keys(req.files));
    
    // Check file_0 specifically
    if (req.files.file_0) {
      const file = req.files.file_0;
      console.log('=== FILE_0 DETAILS ===');
      console.log('Type of file_0:', typeof file);
      console.log('File_0 keys:', Object.keys(file));
      console.log('File name:', file.name);
      console.log('File size:', file.size);
      console.log('File data type:', typeof file.data);
      console.log('File data is Buffer:', Buffer.isBuffer(file.data));
      console.log('File data length:', file.data ? file.data.length : 'undefined');
      console.log('TempFilePath:', file.tempFilePath);
      
    } else {
      console.log('file_0 not found in req.files');
    }
  }
    if (req.files) {
    //  const files = Array.isArray(req.files) ? req.files : [req.files];
    const file = req.files.file_0;
      fileResults = await processFile(file);
      
      // Utiliser le premier fichier traité avec succès pour le service chatbot
    //  const successfulFile = fileResults.find(result => !result.error && result.content);
      if (fileResults.length > 0) {
        uploadedFile = {
          name: fileResults.fileName,
          data: Buffer.from(successfulFile.content || '', 'utf-8')
        };
      }
    }

    // Vérifier qu'il y a du contenu à traiter
    if (!message && !uploadedFile) {
      return res.status(400).json({
        error: "Aucun contenu à traiter",
        message: "Veuillez fournir un message ou des fichiers valides à analyser",
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    // Utiliser le nouveau service intelligent
    console.log(`🧠 Traitement intelligent pour ${userId}`);
    
    const intelligentResponse = await handleChatMessage(message, userId, uploadedFile);

    // Mise en cache de la session
    sessionCache.set(sessionId, {
      userId,
      lastActivity: Date.now(),
      messageCount: (sessionCache.get(sessionId)?.messageCount || 0) + 1
    });

    // Préparation de la réponse
    const response = {
      success: true,
      message: intelligentResponse.response,
      requestId,
      sessionId,
      userId,
      processingTime: `${Date.now() - startTime}ms`,
      type: 'intelligent_chat',
      hasFiles: intelligentResponse.hasFileData,
      fileName: intelligentResponse.fileName,
      conversationLength: intelligentResponse.conversationLength,
      relevantFAQ: intelligentResponse.relevantFAQ || [],
      relevantJobs: intelligentResponse.relevantJobs || [],
      metadata: {
        hasFiles: fileResults.length > 0,
        filesProcessed: fileResults.length,
        filesSuccessful: fileResults.filter(f => !f.error).length,
        responseFormat,
        timestamp: new Date().toISOString(),
        serverTimestamp: Date.now()
      }
    };

    // Ajouter les détails des fichiers si présents
    if (fileResults.length > 0) {
      response.files = fileResults.map(result => ({
        fileName: result.fileName,
        status: result.error ? 'error' : 'success',
        fileSize: result.fileSize,
        processingTime: result.processingTime,
        error: result.error || undefined,
        hasContent: !!result.content
      }));
      
      // Statistiques globales des fichiers
      response.fileStats = {
        total: fileResults.length,
        successful: fileResults.filter(f => !f.error).length,
        errors: fileResults.filter(f => f.error).length,
        totalSize: fileResults.reduce((sum, f) => sum + (f.fileSize || 0), 0),
        avgProcessingTime: Math.round(fileResults.reduce((sum, f) => sum + (f.processingTime || 0), 0) / fileResults.length)
      };
    }

    console.log(`✅ Réponse générée [${requestId}] en ${Date.now() - startTime}ms pour ${userId}`);
    res.status(200).json(response);

  } catch (error) {
    console.error(`❌ Erreur dans /chat [${requestId}]:`, error);
    
    // Réponse d'erreur détaillée pour le debugging
    const errorResponse = {
      error: "Erreur interne du serveur",
      message: "Une erreur s'est produite lors du traitement de votre demande",
      requestId,
      fallback: "Veuillez réessayer ou contacter le support Honest-Inn au 01 98 75 90 28",
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
      errorDetails: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    };
    
    res.status(500).json(errorResponse);
  }
});

// Route pour réinitialiser une conversation
router.post('/reset/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    resetConversation(userId);
    
    res.json({
      success: true,
      message: `Conversation réinitialisée pour ${userId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur reset conversation:', error);
    res.status(500).json({
      error: 'Erreur lors de la réinitialisation',
      details: error.message
    });
  }
});

// Route pour obtenir les statistiques d'une conversation
router.get('/stats/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const stats = getConversationStats(userId);
    
    if (!stats) {
      return res.status(404).json({
        error: 'Aucune conversation trouvée pour cet utilisateur',
        userId
      });
    }
    
    res.json({
      success: true,
      userId,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur stats conversation:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des statistiques',
      details: error.message
    });
  }
});

// Route pour les statistiques détaillées du chat
router.get('/stats', async (req, res) => {
  try {
    const cacheStats = queryCache.getStats();
    const sessionStats = sessionCache.getStats();
    
    const stats = {
      service: 'Chat RH Assistant',
      version: '2.1.0',
      status: 'operational',
      cache: {
        query: {
          keys: queryCache.keys().length,
          hits: cacheStats.hits || 0,
          misses: cacheStats.misses || 0,
          hitRate: cacheStats.hits ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2) + '%' : '0%'
        },
        session: {
          activeSessions: sessionCache.keys().length,
          hits: sessionStats.hits || 0,
          misses: sessionStats.misses || 0
        }
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
          external: Math.round(process.memoryUsage().external / 1024 / 1024) + 'MB'
        },
        nodeVersion: process.version
      },
      features: {
        intelligentChat: true,
        fileProcessing: true,
        conversationMemory: true,
        faqMatching: true,
        jobMatching: true,
        supportedFileTypes: Object.keys(SUPPORTED_FILE_TYPES)
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Route de santé pour monitoring
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    service: 'Chat RH Assistant',
    version: '2.1.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      memory: process.memoryUsage().heapUsed < 1024 * 1024 * 1024, // < 1GB
      cache: queryCache.keys().length >= 0,
      sessions: sessionCache.keys().length >= 0
    }
  };
  
  const allHealthy = Object.values(health.checks).every(check => check === true);
  
  res.status(allHealthy ? 200 : 503).json(health);
});

// Route de test améliorée
router.get('/test', (req, res) => {
  res.json({
    service: "Chat RH Assistant",
    version: "2.1.0",
    status: "operational",
    features: {
      intelligentChat: "Système de chat intelligent avec mémoire de conversation",
      fileProcessing: "Support PDF, Word, images avec OCR, texte",
      conversationMemory: "Mémoire de conversation persistante avec cache",
      faqMatching: "Recherche intelligente dans la base FAQ",
      jobMatching: "Recherche et matching d'offres d'emploi"
    },
    supportedFiles: Object.keys(SUPPORTED_FILE_TYPES),
    maxFileSize: "20MB",
    maxFiles: 5,
    endpoints: {
      chat: "POST / - Chat principal avec IA",
      reset: "POST /reset/:userId - Réinitialiser conversation",
      userStats: "GET /stats/:userId - Stats utilisateur",
      globalStats: "GET /stats - Statistiques détaillées",
      health: "GET /health - État de santé du service",
      test: "GET /test - Informations du service"
    },
    rateLimit: "100 requêtes / 15 minutes",
    timestamp: new Date().toISOString()
  });
});

// Route pour nettoyer le cache (admin)
router.post('/admin/clear-cache', (req, res) => {
  try {
    const queryCacheKeys = queryCache.keys().length;
    const sessionCacheKeys = sessionCache.keys().length;
    
    queryCache.flushAll();
    sessionCache.flushAll();
    
    res.json({
      success: true,
      message: 'Cache vidé avec succès',
      cleared: {
        queryCache: queryCacheKeys,
        sessionCache: sessionCacheKeys
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erreur lors du nettoyage du cache',
      details: error.message
    });
  }
});

module.exports = router;