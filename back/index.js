require('dotenv').config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cluster = require('cluster');
const os = require('os');

// Configuration
const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  tempDir: path.join(__dirname, 'temp-uploads'),
  logsDir: path.join(__dirname, 'logs'),
  clustering: process.env.CLUSTERING === 'true' && process.env.NODE_ENV === 'production'
};

// Clustering pour la production
// if (config.clustering && cluster.isMaster) {
//   const numCPUs = os.cpus().length;
//   console.log(`🚀 Master ${process.pid} démarrage avec ${numCPUs} workers`);
  
//   for (let i = 0; i < Math.min(numCPUs, 4); i++) {
//     cluster.fork();
//   }
  
//   cluster.on('exit', (worker, code, signal) => {
//     console.log(`💀 Worker ${worker.process.pid} died. Restarting...`);
//     cluster.fork();
//   });
  
//   return;
// }

const app = express();

// Initialisation synchrone des dossiers nécessaires
// function initializeDirectoriesSync() {
//   const dirs = [config.tempDir, config.logsDir];
  
//   for (const dir of dirs) {
//     if (!fsSync.existsSync(dir)) {
//       fsSync.mkdirSync(dir, { recursive: true });
//       console.log(`📁 Dossier créé: ${dir}`);
//     }
//   }
// }

// Nettoyage périodique des fichiers temporaires
// async function cleanupTempFiles() {
//   try {
//     const files = await fs.readdir(config.tempDir);
//     const now = Date.now();
//     const maxAge = 60 * 60 * 1000; // 1 heure
    
//     for (const file of files) {
//       const filePath = path.join(config.tempDir, file);
//       try {
//         const stats = await fs.stat(filePath);
//         if (now - stats.mtime.getTime() > maxAge) {
//           await fs.unlink(filePath);
//           console.log(`🗑️ Fichier temporaire supprimé: ${file}`);
//         }
//       } catch (error) {
//         // Fichier déjà supprimé ou inaccessible
//         console.warn(`⚠️ Impossible de nettoyer ${file}:`, error.message);
//       }
//     }
//   } catch (error) {
//     console.error('❌ Erreur nettoyage fichiers temporaires:', error);
//   }
// }

// Initialiser les dossiers avant de créer les streams
//initializeDirectoriesSync();

// Configuration de logging
// const accessLogStream = fsSync.createWriteStream(
//   path.join(config.logsDir, 'access.log'), 
//   { flags: 'a' }
// );

// Middleware de request ID
// app.use((req, res, next) => {
//   req.id = uuidv4();
//   res.setHeader('X-Request-Id', req.id);
//   next();
// });

// Sécurité avec Helmet
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       styleSrc: ["'self'", "'unsafe-inline'"],
//       scriptSrc: ["'self'"],
//       imgSrc: ["'self'", "data:", "https:"],
//     },
//   },
//   crossOriginEmbedderPolicy: false
// }));

// Compression
// app.use(compression({
//   filter: (req, res) => {
//     if (req.headers['x-no-compression']) {
//       return false;
//     }
//     return compression.filter(req, res);
//   },
//   level: 6,
//   threshold: 1024
// }));

// Rate limiting global
// const globalLimiter = rateLimit({
//   windowMs: 5 * 60 * 1000, // 5 minutes
//   max: 100, // 100 requêtes par IP
//   message: {
//     error: "Trop de requêtes de cette IP",
//     retryAfter: 300
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skip: (req) => {
//     return req.path === '/health' || req.path === '/metrics';
//   }
// });

// Rate limiting spécifique pour les uploads
// const uploadLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // 10 uploads par IP
//   message: {
//     error: "Limite d'upload atteinte. Veuillez patienter.",
//     retryAfter: 900
//   }
// });

// CORS configuré de manière sécurisée
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      config.clientUrl,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://honest-inn.com'
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86400 // 24 heures
};

// Application des middlewares
//app.use(globalLimiter);
app.use(cors(corsOptions));

// Logging conditionnel
if (config.nodeEnv === 'production') {
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morgan('dev'));
}

// Body parser avec protection
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    if (buf.length > 10 * 1024 * 1024) {
      throw new Error('JSON trop volumineux');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100
}));

// Configuration des uploads
// const fileUpload = require('express-fileupload');
// app.use(fileUpload({
//   limits: { 
//     fileSize: config.maxFileSize,
//     files: 5
//   },
//   abortOnLimit: true,
//   responseOnLimit: "Fichier trop volumineux (max 10MB)",
//   safeFileNames: true,
//   preserveExtension: true,
//   useTempFiles: true,
//   tempFileDir: config.tempDir,
//   createParentPath: true,
//   parseNested: true,
//   debug: config.nodeEnv === 'development'
// }));

// Types de fichiers autorisés
// const ALLOWED_FILE_TYPES = {
//   'application/pdf': { ext: 'pdf', category: 'document' },
//   'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', category: 'document' },
//   'application/msword': { ext: 'doc', category: 'document' },
//   'text/plain': { ext: 'txt', category: 'text' },
//   'image/jpeg': { ext: 'jpg', category: 'image' },
//   'image/png': { ext: 'png', category: 'image' },
//   'image/webp': { ext: 'webp', category: 'image' },
//   'application/vnd.ms-excel': { ext: 'xls', category: 'spreadsheet' },
//   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', category: 'spreadsheet' }
// };

// Middleware de validation des fichiers
// app.use((req, res, next) => {
//   console.log(req.files)
//   if (!req.files || Object.keys(req.files).length === 0) {
//     return next();
//   }
  
//   const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
//   const validationErrors = [];
  
//   for (const file of files.filter(Boolean)) {
//     const fileType = ALLOWED_FILE_TYPES[file.mimetype];
//     if (!fileType) {
//       validationErrors.push(`Type non supporté: ${file.name} (${file.mimetype})`);
//       continue;
//     }
    
//     const fileExt = path.extname(file.name).toLowerCase().substring(1);
//     if (fileExt !== fileType.ext) {
//       validationErrors.push(`Extension incorrecte: ${file.name}`);
//       continue;
//     }
    
//     if (!/^[a-zA-Z0-9._-]+$/.test(file.name.replace(/\s/g, '_'))) {
//       validationErrors.push(`Nom de fichier invalide: ${file.name}`);
//       continue;
//     }
    
//     file.metadata = {
//       category: fileType.category,
//       validatedType: fileType.ext,
//       uploadTime: new Date().toISOString(),
//       requestId: req.id
//     };
//   }
  
//   if (validationErrors.length > 0) {
//     return res.status(400).json({
//       error: "Validation des fichiers échouée",
//       details: validationErrors,
//       allowedTypes: Object.keys(ALLOWED_FILE_TYPES),
//       requestId: req.id
//     });
//   }
  
//   next();
// });

// Middleware de monitoring des performances
app.use((req, res, next) => {
  req.startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    if (duration > 5000) {
      console.warn(`🐌 Requête lente: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
});

// IMPORTANT: Import des routes APRÈS la configuration des middlewares
const chatRoute = require(path.join(__dirname, 'routes', 'chat.js'));

// Routes principales
app.use("/api/chat", chatRoute);

// Route de santé
app.get("/health", async (req, res) => {
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
    memory: process.memoryUsage(),
    pid: process.pid,
    services: {
      database: "N/A",
      ai_service: "operational",
      file_processing: "operational"
    }
  };
  
  try {
    await fs.access(config.tempDir);
    await fs.access(config.logsDir);
    healthCheck.storage = "operational";
  } catch {
    healthCheck.storage = "degraded";
    healthCheck.status = "degraded";
  }
  
  const statusCode = healthCheck.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// Route de métriques
app.get("/metrics", (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      version: process.version
    },
    application: {
      environment: config.nodeEnv,
      pid: process.pid,
      clustering: config.clustering
    }
  };
  
  res.json(metrics);
});

// Route d'accueil
app.get("/", (req, res) => {
  res.json({ 
    service: "Honest-Inn RH Assistant API",
    version: "2.0.0",
    status: "operational",
    features: [
      "Traitement de PDF/Word/Images/Excel",
      "Assistant RH intelligent avec IA",
      "Gestion des FAQ automatisée",
      "Matching candidats/postes",
      "Analyse de CV avancée",
      "OCR pour images",
      "Rate limiting et sécurité"
    ],
    endpoints: {
      chat: "/api/chat",
      health: "/health",
      metrics: "/metrics"
    },
    limits: {
      fileSize: "10MB",
      requestRate: "100/5min",
      uploadRate: "10/15min"
    },
    supportedFormats: Object.values(ALLOWED_FILE_TYPES).map(type => type.ext),
    documentation: process.env.DOCS_URL || "https://docs.honest-inn.com/api"
  });
});

// Route de nettoyage admin
app.post("/admin/cleanup", (req, res) => {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  
  cleanupTempFiles()
    .then(() => res.json({ message: "Nettoyage effectué avec succès" }))
    .catch(error => res.status(500).json({ error: error.message }));
});

// Middleware 404
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint non trouvé",
    method: req.method,
    path: req.path,
    suggestion: "Consultez la documentation à /",
    requestId: req.id
  });
});

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
  console.error(`❌ Erreur [${req.id}]:`, {
    message: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  if (err.message.includes('file size') || err.message.includes('trop volumineux')) {
    return res.status(413).json({ 
      error: "Fichier trop volumineux",
      limit: "10MB maximum",
      requestId: req.id
    });
  }
  
  if (err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: "Accès non autorisé",
      requestId: req.id
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: "Trop de fichiers",
      limit: "5 fichiers maximum",
      requestId: req.id
    });
  }
  
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({ 
    error: config.nodeEnv === 'production' ? 
           "Erreur interne du serveur" : 
           err.message,
    requestId: req.id,
    fallbackMessage: "Veuillez réessayer ou contacter le support Honest-Inn au 01 98 75 90 28",
    timestamp: new Date().toISOString()
  });
});

// Gestion des signaux système
// process.on('SIGTERM', gracefulShutdown);
// process.on('SIGINT', gracefulShutdown);

// async function gracefulShutdown(signal) {
//   console.log(`\n🔄 Arrêt gracieux suite au signal ${signal}`);
  
//   try {
//     await cleanupTempFiles();
//     console.log('✅ Nettoyage des fichiers temporaires terminé');
//   } catch (error) {
//     console.error('❌ Erreur lors du nettoyage:', error);
//   }
  
//   process.exit(0);
// }

// Gestion des erreurs non capturées
// process.on('uncaughtException', (err) => {
//   console.error('❌ Exception non capturée:', err);
//   process.exit(1);
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error('❌ Promesse rejetée non gérée:', reason);
//   console.error('À:', promise);
//   // Ne pas arrêter le processus pour les rejets de promesses
// });

// Démarrage du serveur
async function startServer() {
  try {
    const server = app.listen(config.port, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${config.port}`);
      console.log(`📊 Mode: ${config.nodeEnv}`);
      console.log(`🔧 PID: ${process.pid}`);
      console.log(`💾 Mémoire: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      
      if (config.clustering) {
        console.log(`👥 Worker ${process.pid} prêt`);
      }
    });
    
    // Configuration du serveur
    server.timeout = 30000;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    
    // Nettoyage périodique toutes les heures
   // setInterval(cleanupTempFiles, 60 * 60 * 1000);
    
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

startServer();