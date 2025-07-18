const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const fs = require('fs').promises;
const path = require("path");
const { body, validationResult } = require("express-validator");
const {
  handleChatMessage,
  processUploadedFile,
  resetConversation,
  getConversationStats,
} = require("../services/rhAssistant");
const NodeCache = require("node-cache");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");



const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/chatbot');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cv-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },

fileFilter: function (req, file, cb) {
  // Extensions autorisées
  const allowedExtensions = /pdf|doc|docx|txt|jpg|jpeg|png|gif/;

  // Vérifie l'extension du fichier
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());

  // Vérifie le mimetype
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
  ];
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers PDF, DOC, DOCX, TXT et images (JPG, PNG, GIF) sont autorisés'));
  }
}
});

// Cache pour les résultats fréquents
const queryCache = new NodeCache({ stdTTL: 1800 }); // 30 minutes
const sessionCache = new NodeCache({ stdTTL: 3600 }); // 1 heure pour les sessions

// Rate limiting ajusté
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Augmenté pour une meilleure UX
  message: {
    error: "Trop de requêtes. Veuillez patienter avant de réessayer.",
    retryAfter: Math.ceil((15 * 60) / 60),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `${req.ip}-${req.body?.userId || "anonymous"}`;
  },
});

// Validation des entrées améliorée
const validateChatInput = [
  body("message")
    .optional()
    .isLength({ min: 0, max: 2000 })
    .withMessage("Le message ne peut pas dépasser 2000 caractères")
    .trim(),
  body("userId")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("ID utilisateur invalide")
    .trim(),
  body("context")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Le contexte ne peut pas dépasser 500 caractères")
    .trim(),
  body("responseFormat")
    .optional()
    .isIn(["detailed", "concise", "bullets"])
    .withMessage("Format de réponse invalide"),
  body("sessionId").optional().isUUID().withMessage("ID de session invalide"),
];

// Types de fichiers supportés avec leurs extensions
const SUPPORTED_FILE_TYPES = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  doc: ["application/msword"],
  txt: ["text/plain"],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg", "image/jpg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
};

// Configuration des types MIME acceptés
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Middleware pour générer des IDs de requête
router.use((req, res, next) => {
  req.requestId = uuidv4();
  next();
});

// Validation des fichiers uploadés
function validateFile(file) {
  const errors = [];

  if (!file) {
    errors.push("Fichier invalide ou manquant");
    return errors;
  }

  // Vérification extension
  const fileExt = file.originalname ? file.originalname.split(".").pop()?.toLowerCase() : 
                  file.name ? file.name.split(".").pop()?.toLowerCase() : null;
  
  if (!fileExt || !SUPPORTED_FILE_TYPES[fileExt]) {
    errors.push(`Type de fichier non supporté: .${fileExt || "inconnu"}`);
  }

  // Vérification MIME type si disponible
  if (file.mimetype && !ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
    errors.push(`Type MIME non supporté: ${file.mimetype}`);
  }

  // Vérification taille
  if (file.size > 20 * 1024 * 1024) {
    errors.push("Fichier trop volumineux (max 20MB)");
  }

  // Vérification nom de fichier
  const fileName = file.originalname || file.name || "";
  if (fileName.length > 255) {
    errors.push("Nom de fichier trop long");
  }

  return errors;
}


async function processFile(file) {
  if (!file) return null;
  console.log(`📎 Traitement du fichier: ${file.originalname || file.name}`);
  const startTime = Date.now();

  try {
    // Validation préalable
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      return {
        fileName: file.originalname || file.name || "Fichier inconnu",
        error: validationErrors.join(", "),
        metadata: {
          status: "validation_error",
          processingTime: Date.now() - startTime,
        },
      };
    }

    console.log(`🔄 Traitement de ${file.originalname || file.name} (${file.size} bytes)...`);

    // Read the file data from the file system
    const filePath = file.path;
    const fileData = await fs.readFile(filePath);
    await fs.unlink(filePath);

    const fileName = file.originalname || file.name;

    if (!fileData) {
      return {
        fileName: fileName,
        error: "Données du fichier manquantes",
        metadata: {
          status: "processing_error",
          processingTime: Date.now() - startTime,
        },
      };
    }

    // Utiliser la fonction du service rhAssistant
    const result = await processUploadedFile(fileData, fileName);

    if (result && result.extractedText) {
      console.log(`✅ Fichier traité: ${fileName} en ${Date.now() - startTime}ms`);
      return {
        fileName: fileName,
        fileSize: file.size,
        mimeType: file.mimetype,
        processingTime: Date.now() - startTime,
        content: result.extractedText,
        metadata: {
          ...result,
          status: "success",
        },
      };
    } else {
      return {
        fileName: fileName,
        fileSize: file.size,
        error: "Échec de l'extraction du texte",
        processingTime: Date.now() - startTime,
        metadata: {
          status: "processing_error",
        },
      };
    }
  } catch (error) {
    console.error(`❌ Échec traitement ${file.originalname || file.name}:`, error);
    return {
      fileName: file.originalname || file.name,
      fileSize: file.size,
      error: `Erreur de traitement: ${error.message}`,
      processingTime: Date.now() - startTime,
      metadata: {
        status: "processing_error",
        errorDetails: error.message,
      },
    };
  }
}



// Route principale de chat avec système intelligent
router.post("/", 
  chatLimiter, 
  upload.single('file'), // Utiliser multer pour gérer un seul fichier
  validateChatInput, 
  async (req, res) => {
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
          timestamp: new Date().toISOString(),
        });
      }

      const {
        message = "",
        userId = `anonymous-${Date.now()}`,
        context = "",
        responseFormat = "detailed",
        sessionId = uuidv4(),
      } = req.body;

      console.log(
        `🎯 Nouvelle requête [${requestId}] de ${userId}: ${message.substring(0, 100)}${
          message.length > 100 ? "..." : ""
        }`
      );

      // Traitement des fichiers si présents
      let fileResults = [];
      let combinedFileContent = "";
      let fileNames = [];

      // Vérifier d'abord si des fichiers sont présents
      console.log('📁 Vérification des fichiers...');
      console.log('req.file:', req.file);
      
      if (req.file) {
     //   console.log(`📁 ${req.files.length} fichier(s) détecté(s)`);
        
        // Afficher les détails des fichiers pour debugging
        // req.files.forEach((file, index) => {
        //   console.log(`Fichier ${index + 1}:`, {
        //     originalname: file.originalname,
        //     mimetype: file.mimetype,
        //     size: file.size,
        //     path: file.path
        //   });
        // });
        
        try {
          // Traiter tous les fichiers
         // fileResults = await processFiles(req.files);
         fileResults = await processFile(req.file);
         console.log(fileResults)
          
          // Combiner le contenu de tous les fichiers traités avec succès
       //   const successfulFiles = fileResults.filter(result => !result.error && result.content);
          
          if (!fileResults.error && fileResults.content) {
            // combinedFileContent = successfulFiles.map(file => {
            //   fileNames.push(file.fileName);
            //   return `=== Contenu de ${file.fileName} ===\n${file.content}\n`;
            // }).join('\n');
            
        //    console.log(`✅ ${successfulFiles.length} fichier(s) traité(s) avec succès`);
         //   console.log(`📝 Contenu combiné: ${combinedFileContent.length} caractères`);
          } else {
            console.log('⚠️ Aucun fichier traité avec succès');
          }
        } catch (fileError) {
          console.error('❌ Erreur lors du traitement des fichiers:', fileError);
          // Continue même si le traitement des fichiers échoue
        }
      } else {
        console.log('📁 Aucun fichier détecté');
      }

      // Vérifier qu'il y a du contenu à traiter
      if (!message && !fileResults.content) {
        return res.status(400).json({
          error: "Aucun contenu à traiter",
          message: "Veuillez fournir un message ou des fichiers valides à analyser",
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      // Préparer le fichier pour le service (si du contenu existe)
      let uploadedFile = null;
      if (fileResults.content) {
        uploadedFile = {
          name: 'temp-' + uuidv4() + '.txt',
          data: Buffer.from(fileResults.content, 'utf-8'),
        };
      }

      // Utiliser le service intelligent
      console.log(`🧠 Traitement intelligent pour ${userId}`);
      const intelligentResponse = await handleChatMessage(message, userId, uploadedFile);

      // Mise en cache de la session
      sessionCache.set(sessionId, {
        userId,
        lastActivity: Date.now(),
        messageCount: (sessionCache.get(sessionId)?.messageCount || 0) + 1,
      });

      // Préparation de la réponse
      const response = {
        success: true,
        message: intelligentResponse.response,
        requestId,
        sessionId,
        userId,
        processingTime: `${Date.now() - startTime}ms`,
        type: "intelligent_chat",
        hasFiles: !!uploadedFile,
        fileName: uploadedFile ? uploadedFile.name : null,
        conversationLength: intelligentResponse.conversationLength,
        relevantFAQ: intelligentResponse.relevantFAQ || [],
        relevantJobs: intelligentResponse.relevantJobs || [],
        metadata: {
          hasFiles: fileResults.length > 0,
          filesProcessed: fileResults ? '1' : '0',
         // filesSuccessful: fileResults.filter((f) => !f.error).length,
          responseFormat,
          timestamp: new Date().toISOString(),
          serverTimestamp: Date.now(),
        },
      };

      // Ajouter les détails des fichiers si présents
      if (fileResults.length > 0) {
        response.files = fileResults.map((result) => ({
          fileName: result.fileName,
          status: result.error ? "error" : "success",
          fileSize: result.fileSize,
          processingTime: result.processingTime,
          error: result.error || undefined,
          hasContent: !!result.content,
        }));

        // Statistiques globales des fichiers
        response.fileStats = {
          total: fileResults.length,
          successful: fileResults.filter((f) => !f.error).length,
          errors: fileResults.filter((f) => f.error).length,
          totalSize: fileResults.reduce((sum, f) => sum + (f.fileSize || 0), 0),
          avgProcessingTime: Math.round(
            fileResults.reduce((sum, f) => sum + (f.processingTime || 0), 0) / fileResults.length
          ),
        };
      }

      console.log(`✅ Réponse générée [${requestId}] en ${Date.now() - startTime}ms pour ${userId}`);
      res.status(200).json(response);

    } catch (error) {
      console.error(`❌ Erreur dans /chat [${requestId}]:`, error);
      
      // Gestion spécifique des erreurs de parsing
      if (error.message === 'Unexpected end of form' || 
          error.message.includes('Unexpected end of') ||
          error.message.includes('Parse Error')) {
        return res.status(400).json({
          error: 'Données du formulaire invalides',
          message: 'Le formulaire semble corrompu ou incomplet. Veuillez réessayer.',
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const errorResponse = {
        error: "Erreur interne du serveur",
        message: "Une erreur s'est produite lors du traitement de votre demande",
        requestId,
        fallback: "Veuillez réessayer ou contacter le support Honest-Inn au 01 98 75 90 28",
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
        errorDetails:
          process.env.NODE_ENV === "development"
            ? {
                message: error.message,
                stack: error.stack,
              }
            : undefined,
      };

      res.status(500).json(errorResponse);
    }
  }
);

// Route alternative pour les messages texte uniquement (sans fichiers)
router.post("/text", 
  chatLimiter, 
  express.json(), // Parse JSON instead of multipart
  validateChatInput, 
  async (req, res) => {
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
          timestamp: new Date().toISOString(),
        });
      }

      const {
        message = "",
        userId = `anonymous-${Date.now()}`,
        context = "",
        responseFormat = "detailed",
        sessionId = uuidv4(),
      } = req.body;

      // Vérifier qu'il y a un message
      if (!message) {
        return res.status(400).json({
          error: "Message requis",
          message: "Veuillez fournir un message",
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`🎯 Message texte [${requestId}] de ${userId}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`);

      // Utiliser le service intelligent sans fichier
      const intelligentResponse = await handleChatMessage(message, userId, null);

      // Mise en cache de la session
      sessionCache.set(sessionId, {
        userId,
        lastActivity: Date.now(),
        messageCount: (sessionCache.get(sessionId)?.messageCount || 0) + 1,
      });

      // Réponse
      const response = {
        success: true,
        message: intelligentResponse.response,
        requestId,
        sessionId,
        userId,
        processingTime: `${Date.now() - startTime}ms`,
        type: "text_chat",
        hasFiles: false,
        fileName: null,
        conversationLength: intelligentResponse.conversationLength,
        relevantFAQ: intelligentResponse.relevantFAQ || [],
        relevantJobs: intelligentResponse.relevantJobs || [],
        metadata: {
          hasFiles: false,
          filesProcessed: 0,
          filesSuccessful: 0,
          responseFormat,
          timestamp: new Date().toISOString(),
          serverTimestamp: Date.now(),
        },
      };

      console.log(`✅ Réponse texte générée [${requestId}] en ${Date.now() - startTime}ms pour ${userId}`);
      res.status(200).json(response);

    } catch (error) {
      console.error(`❌ Erreur dans /text [${requestId}]:`, error);

      const errorResponse = {
        error: "Erreur interne du serveur",
        message: "Une erreur s'est produite lors du traitement de votre demande",
        requestId,
        fallback: "Veuillez réessayer ou contacter le support Honest-Inn au 01 98 75 90 28",
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
        errorDetails:
          process.env.NODE_ENV === "development"
            ? {
                message: error.message,
                stack: error.stack,
              }
            : undefined,
      };

      res.status(500).json(errorResponse);
    }
  }
);

// Route pour réinitialiser une conversation
router.post("/reset/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    resetConversation(userId);

    res.json({
      success: true,
      message: `Conversation réinitialisée pour ${userId}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erreur reset conversation:", error);
    res.status(500).json({
      error: "Erreur lors de la réinitialisation",
      details: error.message,
    });
  }
});

// Route pour obtenir les statistiques d'une conversation
router.get("/stats/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const stats = getConversationStats(userId);

    if (!stats) {
      return res.status(404).json({
        error: "Aucune conversation trouvée pour cet utilisateur",
        userId,
      });
    }

    res.json({
      success: true,
      userId,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erreur stats conversation:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des statistiques",
      details: error.message,
    });
  }
});

// Route pour les statistiques détaillées du chat
router.get("/stats", async (req, res) => {
  try {
    const cacheStats = queryCache.getStats();
    const sessionStats = sessionCache.getStats();

    const stats = {
      service: "Chat RH Assistant",
      version: "2.1.0",
      status: "operational",
      cache: {
        query: {
          keys: queryCache.keys().length,
          hits: cacheStats.hits || 0,
          misses: cacheStats.misses || 0,
          hitRate: cacheStats.hits
            ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2) + "%"
            : "0%",
        },
        session: {
          activeSessions: sessionCache.keys().length,
          hits: sessionStats.hits || 0,
          misses: sessionStats.misses || 0,
        },
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
          external: Math.round(process.memoryUsage().external / 1024 / 1024) + "MB",
        },
        nodeVersion: process.version,
      },
      features: {
        intelligentChat: true,
        fileProcessing: true,
        conversationMemory: true,
        faqMatching: true,
        jobMatching: true,
        supportedFileTypes: Object.keys(SUPPORTED_FILE_TYPES),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(stats);
  } catch (error) {
    console.error("❌ Erreur stats:", error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Route de santé pour monitoring
router.get("/health", (req, res) => {
  const health = {
    status: "healthy",
    service: "Chat RH Assistant",
    version: "2.1.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      memory: process.memoryUsage().heapUsed < 1024 * 1024 * 1024, // < 1GB
      cache: queryCache.keys().length >= 0,
      sessions: sessionCache.keys().length >= 0,
    },
  };

  const allHealthy = Object.values(health.checks).every((check) => check === true);
  res.status(allHealthy ? 200 : 503).json(health);
});

// Route de test améliorée
router.get("/test", (req, res) => {
  res.json({
    service: "Chat RH Assistant",
    version: "2.1.0",
    status: "operational",
    features: {
      intelligentChat: "Système de chat intelligent avec mémoire de conversation",
      fileProcessing: "Support PDF, Word, images avec OCR, texte",
      conversationMemory: "Mémoire de conversation persistante avec cache",
      faqMatching: "Recherche intelligente dans la base FAQ",
      jobMatching: "Recherche et matching d'offres d'emploi",
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
      test: "GET /test - Informations du service",
    },
    rateLimit: "100 requêtes / 15 minutes",
    timestamp: new Date().toISOString(),
  });
});

// Route pour nettoyer le cache (admin)
router.post("/admin/clear-cache", (req, res) => {
  try {
    const queryCacheKeys = queryCache.keys().length;
    const sessionCacheKeys = sessionCache.keys().length;

    queryCache.flushAll();
    sessionCache.flushAll();

    res.json({
      success: true,
      message: "Cache vidé avec succès",
      cleared: {
        queryCache: queryCacheKeys,
        sessionCache: sessionCacheKeys,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Erreur lors du nettoyage du cache",
      details: error.message,
    });
  }
});

module.exports = router;