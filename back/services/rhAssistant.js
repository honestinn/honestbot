// 🤖 rhAssistant.js - Corrigé pour API Mistral AI
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();

// Configuration Mistral
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const CONVERSATION_CACHE = new NodeCache({ stdTTL: 7200 }); // 2 heures

// Chemins des fichiers de données
const FAQ_PATH = path.join(__dirname, '../data/faq_rh_questions.json');
const JOBS_PATH = path.join(__dirname, '../data/job_offers.json');
const CANDIDATES_PATH = path.join(__dirname, '../data/candidates.json');

// 💾 GESTION DE LA MÉMOIRE DE CONVERSATION
class ConversationMemory {
  constructor(userId) {
    this.userId = userId;
    this.context = CONVERSATION_CACHE.get(userId) || {
      history: [],
      sessionStart: Date.now(),
      extractedFileData: null,
      requestType: null
    };
  }

  addMessage(role, content) {
    const message = {
      role,
      content,
      timestamp: Date.now()
    };

    this.context.history.push(message);
    
    // Limiter à 15 messages pour éviter les tokens excessifs
    if (this.context.history.length > 15) {
      this.context.history = this.context.history.slice(-15);
    }

    this.save();
  }

  setFileData(fileData) {
    this.context.extractedFileData = fileData;
    this.save();
  }

  setRequestType(type) {
    this.context.requestType = type;
    this.save();
  }

  getRecentHistory(maxMessages = 6) {
    return this.context.history
      .slice(-maxMessages)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  // Retourne l'historique au format Mistral
  getMistralHistory(maxMessages = 6) {
    return this.context.history
      .slice(-maxMessages)
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
  }

  save() {
    CONVERSATION_CACHE.set(this.userId, this.context);
  }

  getContext() {
    return this.context;
  }
}

// 📚 CHARGEMENT DES DONNÉES
async function loadKnowledgeBase() {
  try {
    const [faqData, jobsData, candidatesData] = await Promise.all([
      fs.readFile(FAQ_PATH, 'utf-8').then(JSON.parse).catch(() => []),
      fs.readFile(JOBS_PATH, 'utf-8').then(JSON.parse).catch(() => []),
      fs.readFile(CANDIDATES_PATH, 'utf-8').then(JSON.parse).catch(() => [])
    ]);

    return { faqData, jobsData, candidatesData };
  } catch (error) {
    console.error('❌ Erreur chargement base de connaissance:', error);
    return { faqData: [], jobsData: [], candidatesData: [] };
  }
}

// 🎯 ANALYSE DU TYPE DE DEMANDE
function analyzeRequestType(userMessage) {
  const message = userMessage.toLowerCase();
  
  const jobIndicators = [
    'emploi', 'poste', 'travail', 'offre', 'recrutement', 'embauche',
    'cherche travail', 'recherche emploi', 'candidature', 'postuler',
    'job', 'boulot', 'mission', 'cdd', 'cdi', 'interim'
  ];
  
  const candidateIndicators = [
    'candidat', 'profil', 'cv', 'recruter', 'personnel', 'talent',
    'cherche candidat', 'besoin de', 'recherche profil', 'disponible',
    'serveur', 'cuisinier', 'chef', 'barman', 'réceptionniste'
  ];
  
  const faqIndicators = [
    'comment', 'pourquoi', 'quand', 'où', 'qui', 'quoi',
    'procédure', 'démarche', 'étapes', 'info', 'renseignement',
    'horaires', 'contact', 'adresse', 'téléphone'
  ];

  if (jobIndicators.some(indicator => message.includes(indicator))) {
    return 'job_search';
  } else if (candidateIndicators.some(indicator => message.includes(indicator))) {
    return 'candidate_search';
  } else if (faqIndicators.some(indicator => message.includes(indicator))) {
    return 'faq';
  }
  
  return 'general';
}

// 🔍 RECHERCHE DANS LA FAQ
function searchFAQ(userMessage, faqData) {
  if (!Array.isArray(faqData) || faqData.length === 0) {
    return [];
  }

  const cleanMessage = userMessage.toLowerCase();
  const words = cleanMessage.split(/\s+/).filter(word => word.length > 2);
  
  const scoredFAQ = faqData.map(item => {
    let score = 0;
    const questionText = (item.question || '').toLowerCase();
    const answerText = (item.answer || item.reponse || '').toLowerCase();
    const tagsText = (item.tags || []).join(' ').toLowerCase();
    const categoryText = (item.category || item.categorie || '').toLowerCase();
    
    // Score basé sur les mots-clés
    words.forEach(word => {
      if (questionText.includes(word)) score += 4;
      if (answerText.includes(word)) score += 2;
      if (tagsText.includes(word)) score += 3;
      if (categoryText.includes(word)) score += 2;
    });
    
    // Bonus pour correspondance exacte
    if (questionText.includes(cleanMessage)) score += 10;
    
    return { ...item, score };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scoredFAQ;
}

// 💼 RECHERCHE D'OFFRES D'EMPLOI
function searchJobs(userMessage, jobsData) {
  if (!Array.isArray(jobsData) || jobsData.length === 0) {
    return [];
  }

  const keywords = userMessage.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const requestType = analyzeRequestType(userMessage);
  
  const scoredJobs = jobsData.map(job => {
    let score = 0;
    const jobText = [
      job.title || job.intitule || '',
      job.description || job.missions || '',
      job.company || job.entreprise || '',
      job.location || job.lieu || '',
      job.contract || job.contrat || '',
      job.sector || job.secteur || ''
    ].join(' ').toLowerCase();
    
    keywords.forEach(keyword => {
      if (jobText.includes(keyword)) score += 2;
    });

    // Bonus si c'est une recherche d'emploi explicite
    if (requestType === 'job_search') score += 3;

    // Bonus pour les offres récentes
    if (job.datePublication) {
      const jobDate = new Date(job.datePublication);
      const daysSince = (Date.now() - jobDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) score += 2;
    }
    
    return { ...job, score };
  }).filter(job => job.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return scoredJobs;
}

// 👥 RECHERCHE DE CANDIDATS
function searchCandidates(userMessage, candidatesData) {
  if (!Array.isArray(candidatesData) || candidatesData.length === 0) {
    return [];
  }

  const keywords = userMessage.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const requestType = analyzeRequestType(userMessage);
  
  const candidateKeywords = [
    'candidat', 'profil', 'cv', 'compétence', 'expérience', 'serveur', 'cuisinier', 
    'chef', 'barman', 'réceptionniste', 'manager', 'hôtellerie', 'restauration',
    'disponible', 'recruter', 'embaucher', 'cherche'
  ];
  
  const isCandidateSearch = candidateKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  ) || requestType === 'candidate_search';

  const scoredCandidates = candidatesData.map(candidate => {
    let score = 0;
    const candidateText = [
      candidate.nom || '',
      candidate.prenom || '',
      candidate.poste || candidate.metier || candidate.profession || '',
      candidate.competences || candidate.skills || '',
      candidate.experience || candidate.exp || '',
      candidate.localisation || candidate.ville || candidate.lieu || '',
      candidate.secteur || candidate.domaine || ''
    ].join(' ').toLowerCase();
    
    keywords.forEach(keyword => {
      if (candidateText.includes(keyword)) score += 2;
    });

    // Bonus si recherche explicite de candidats
    if (isCandidateSearch) score += 3;

    // Bonus pour disponibilité immédiate
    if (candidate.disponibilite === 'immédiate' || candidate.availability === 'immediate') {
      score += 2;
    }
    
    return { ...candidate, score };
  }).filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  // Si recherche explicite mais pas de résultats, retourner quelques candidats
  if (isCandidateSearch && scoredCandidates.length === 0) {
    return candidatesData.slice(0, 3).map(candidate => ({ ...candidate, score: 1 }));
  }

  return scoredCandidates;
}

// 🤖 GÉNÉRATION DE RÉPONSE AVEC MISTRAL AI
async function generateAIResponse(userMessage, context, knowledgeBase, fileData = null) {
  if (!MISTRAL_API_KEY) {
    return "Service IA temporairement indisponible. Contactez-nous au 01 98 75 90 28.";
  }

  try {
    // Analyser le type de demande
    const requestType = analyzeRequestType(userMessage);
    
    // Construction du prompt système optimisé
    let systemPrompt = `Tu es l'assistante RH virtuelle d'Honest-Inn, une agence de placement spécialisée en hôtellerie-restauration.
t'as le droit d'évaluer des cvs et de donner ton avis 
INFORMATIONS SUR HONEST-INN:
- Agence de recrutement spécialisée hôtellerie-restauration
- Services: placement CDI/CDD, missions intérim, conseil RH
- Téléphone: 01 98 75 90 28
- Email: contact@honest-inn.com
- Horaires: Lundi-Vendredi 9h-18h
- Adresse: 104 rue Gabriel Péri, Gentilly

TYPE DE DEMANDE DÉTECTÉ: ${requestType}

BASE DE CONNAISSANCE FOURNIE:`;

    // Ajouter le contenu pertinent selon le type de demande
    if (requestType === 'faq' || requestType === 'general') {
      const relevantFAQ = searchFAQ(userMessage, knowledgeBase.faqData);
      if (relevantFAQ.length > 0) {
        systemPrompt += "\n\nQUESTIONS FRÉQUENTES PERTINENTES:\n";
        relevantFAQ.forEach((faq, index) => {
          systemPrompt += `${index + 1}. Q: ${faq.question}\n   R: ${faq.answer || faq.reponse}\n`;
          if (faq.tags) systemPrompt += `   Tags: ${faq.tags.join(', ')}\n`;
          systemPrompt += "\n";
        });
      }
    }

    if (requestType === 'job_search' || requestType === 'general') {
      const relevantJobs = searchJobs(userMessage, knowledgeBase.jobsData);
      if (relevantJobs.length > 0) {
        systemPrompt += "\nOFFRES D'EMPLOI DISPONIBLES:\n";
        relevantJobs.forEach((job, index) => {
          systemPrompt += `${index + 1}. ${job.title || job.intitule}
   Entreprise: ${job.company || job.entreprise}
   Lieu: ${job.location || job.lieu}
   Contrat: ${job.contract || job.contrat || job.type || 'Non spécifié'}
   Salaire: ${job.salary || job.salaire || 'À négocier'}
   Description: ${(job.description || job.missions || '').slice(0, 300)}...
   Profil: ${(job.requirements || job.profil || '').slice(0, 200)}...
   Contact: Via agence Honest-Inn\n\n`;
        });
      }
    }

    if (requestType === 'candidate_search' || requestType === 'general') {
      const relevantCandidates = searchCandidates(userMessage, knowledgeBase.candidatesData);
      if (relevantCandidates.length > 0) {
        systemPrompt += "\nPROFILS CANDIDATS DISPONIBLES:\n";
        relevantCandidates.forEach((candidate, index) => {
          systemPrompt += `${index + 1}. ${candidate.prenom || ''} ${(candidate.nom || '').charAt(0)}.
   Poste recherché: ${candidate.poste || candidate.metier || candidate.profession || 'Non spécifié'}
   Expérience: ${candidate.experience || candidate.exp || 'Non spécifiée'}
   Localisation: ${candidate.localisation || candidate.ville || candidate.lieu || 'Non spécifiée'}
   Compétences: ${candidate.competences || candidate.skills || 'Non spécifiées'}
   Disponibilité: ${candidate.disponibilite || candidate.availability || 'À voir'}
   Contact: Via agence Honest-Inn (confidentialité)\n\n`;
        });
      }
    }

    // Ajouter les données du fichier si disponibles
    if (fileData && fileData.extractedText) {
      systemPrompt += `\n\nDONNÉES EXTRAITES DU FICHIER "${fileData.fileName}":
${fileData.extractedText}

Si ce fichier contient un CV, analyse-le pour proposer des offres correspondantes.`;
    }

    systemPrompt += `\n\nINSTRUCTIONS DE RÉPONSE:
- Réponds de manière chaleureuse et professionnelle
- Base tes réponses sur les informations fournies ci-dessus
- Pour les profils candidats, présente-les de manière attractive
- Pour les offres, mets en avant les points attractifs
- Si tu ne connais pas la réponse, oriente vers nos conseillers
- Propose des actions concrètes (appeler, postuler, contacter)
- Sois concise mais complète (max 800 mots)
- Utilise des emojis pour rendre la réponse engageante
- Respecte la confidentialité des données personnelles
- Ne dis jamais bonjour ou aucune formule de salutation en début de réponse`;

    // Construire les messages pour Mistral
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Ajouter l'historique de conversation
    const history = context.getMistralHistory(4);
    messages.push(...history);

    // Ajouter le message actuel
    messages.push({ role: "user", content: userMessage });

    // Appel à l'API Mistral avec les bons paramètres
    const response = await axios.post(
      `${MISTRAL_BASE_URL}/chat/completions`,
      {
        model: "mistral-small-latest",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.9,
        stream: false
      },
      {
        headers: {
          "Authorization": `Bearer ${MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    // Vérifier la réponse
    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error('Réponse API Mistral invalide');
    }

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error('❌ Erreur appel API Mistral:', error.response?.data || error.message);
    
    // Réponse de fallback intelligente
    const requestType = analyzeRequestType(userMessage);
    
    if (requestType === 'job_search') {
      return `Je rencontre une difficulté technique pour rechercher les offres d'emploi. 

📞 Nos conseillers peuvent vous présenter nos offres actuelles :
• Téléphone : 01 98 75 90 28
• Email : contact@honest-inn.com
• Horaires : Lundi-Vendredi 9h-18h

Ils ont accès à toutes nos opportunités en hôtellerie-restauration !`;
    } else if (requestType === 'candidate_search') {
      return `Je rencontre une difficulté technique pour rechercher les profils candidats. 

📞 Nos conseillers peuvent vous présenter des candidats qualifiés :
• Téléphone : 01 98 75 90 28
• Email : contact@honest-inn.com
• Horaires : Lundi-Vendredi 9h-18h

Ils pourront vous proposer des profils correspondant à vos besoins !`;
    } else {
      return `Je rencontre une difficulté technique en ce moment. 

📞 Pour une aide immédiate, contactez nos conseillers :
• Téléphone : 01 98 75 90 28
• Email : contact@honest-inn.com
• Horaires : Lundi-Vendredi 9h-18h

Ils pourront répondre à toutes vos questions !`;
    }
  }
}

// 📄 TRAITEMENT DES FICHIERS UPLOADÉS (fonction manquante)
async function processUploadedFile(fileBuffer, fileName) {
  try {
    // Vérifier l'extension du fichier
    const ext = path.extname(fileName).toLowerCase();
    let extractedText = '';

    if (ext === '.txt') {
      extractedText = fileBuffer.toString('utf-8');
      console.log(extractedText)
    } else if (ext === '.pdf') {
      // Ici, vous devriez utiliser une bibliothèque comme pdf-parse
      extractedText = 'Contenu PDF (nécessite pdf-parse)';
    } else if (ext === '.docx') {
      // Ici, vous devriez utiliser une bibliothèque comme mammoth
      extractedText = 'Contenu DOCX (nécessite mammoth)';
    } else {
      extractedText = 'Format de fichier non supporté';
    }

    return {
      fileName: fileName,
      extractedText: extractedText.slice(0, 2000), // Limiter à 2000 caractères
      fileSize: fileBuffer.length,
      processedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Erreur traitement fichier:', error);
    return null;
  }
}

// 🚀 FONCTION PRINCIPALE
async function handleChatMessage(userMessage, userId, uploadedFile = null) {
  try {
    console.log(`💬 Message reçu de ${userId}: ${userMessage.slice(0, 100)}...`);
    
    // Validation des paramètres
    if (!userMessage || typeof userMessage !== 'string') {
      throw new Error('Message utilisateur invalide');
    }
    
    if (!userId || typeof userId !== 'string') {
      throw new Error('ID utilisateur invalide');
    }

    // Initialiser la mémoire de conversation
    const memory = new ConversationMemory(userId);
    
    // Analyser et stocker le type de demande
    const requestType = analyzeRequestType(userMessage);
    memory.setRequestType(requestType);
    console.log('Uploaded File ?'  + uploadedFile)
    // Traiter le fichier uploadé si présent
    let processedFile = null;
    if (uploadedFile) {
      processedFile = await processUploadedFile(uploadedFile.data, uploadedFile.name);
      if (processedFile) {
        memory.setFileData(processedFile);
        console.log(`✅ Fichier traité: ${processedFile.fileName}`);
      }
    }
    
    // Utiliser les données de fichier existantes si pas de nouveau fichier
    const fileData = processedFile || memory.context.extractedFileData;
    
    // Charger la base de connaissance
    const knowledgeBase = await loadKnowledgeBase();
    
    // Enregistrer le message utilisateur
    memory.addMessage('user', userMessage);
    
    // Générer la réponse avec Mistral
    const aiResponse = await generateAIResponse(userMessage, memory, knowledgeBase, fileData);
    
    // Enregistrer la réponse
    memory.addMessage('assistant', aiResponse);
    
    // Préparer la réponse finale avec métadonnées
    const response = {
      response: aiResponse,
      requestType: requestType,
      hasFileData: !!fileData,
      fileName: fileData?.fileName || null,
      conversationLength: memory.context.history.length,
      relevantFAQ: searchFAQ(userMessage, knowledgeBase.faqData).slice(0, 3),
      relevantJobs: searchJobs(userMessage, knowledgeBase.jobsData).slice(0, 4),
      relevantCandidates: searchCandidates(userMessage, knowledgeBase.candidatesData).slice(0, 4),
      searchStats: {
        faqFound: searchFAQ(userMessage, knowledgeBase.faqData).length,
        jobsFound: searchJobs(userMessage, knowledgeBase.jobsData).length,
        candidatesFound: searchCandidates(userMessage, knowledgeBase.candidatesData).length
      }
    };
    
    console.log(`✅ Réponse générée pour ${userId} (type: ${requestType})`);
    return response;
    
  } catch (error) {
    console.error('❌ Erreur traitement message chatbot:', error);
    return {
      response: `Désolé, je rencontre une difficulté technique. 

📞 Nos conseillers sont disponibles au **01 98 75 90 28** pour vous aider immédiatement !

✉️ Vous pouvez aussi nous écrire à contact@honest-inn.com`,
      hasFileData: false,
      fileName: null,
      requestType: 'error',
      error: true
    };
  }
}

// 🔄 FONCTIONS UTILITAIRES
function resetConversation(userId) {
  CONVERSATION_CACHE.del(userId);
  console.log(`🔄 Conversation réinitialisée pour ${userId}`);
}

function getConversationStats(userId) {
  const context = CONVERSATION_CACHE.get(userId);
  if (!context) return null;
  
  return {
    messageCount: context.history.length,
    sessionDuration: Date.now() - context.sessionStart,
    hasFileData: !!context.extractedFileData,
    requestType: context.requestType,
    lastActivity: context.history.length > 0 ? 
      context.history[context.history.length - 1].timestamp : null
  };
}

// 📌 EXPORT DES FONCTIONNALITÉS
module.exports = {
  handleChatMessage,
  processUploadedFile,
  resetConversation,
  getConversationStats,
  ConversationMemory,
  searchFAQ,
  searchJobs,
  searchCandidates,
  analyzeRequestType,
  loadKnowledgeBase
};

// 🧪 EXEMPLE D'UTILISATION
/*
(async () => {
  // Test recherche d'emploi
  const jobSearchMessage = "Je cherche un poste de serveur dans un restaurant";
  const jobResponse = await handleChatMessage(jobSearchMessage, "test-user-job");
  console.log("=== RECHERCHE D'EMPLOI ===");
  console.log("Réponse:", jobResponse.response);
  console.log("Type détecté:", jobResponse.requestType);
  console.log("Offres trouvées:", jobResponse.relevantJobs.length);
  
  // Test recherche de candidats
  const candidateSearchMessage = "Avez-vous des profils de cuisiniers expérimentés disponibles ?";
  const candidateResponse = await handleChatMessage(candidateSearchMessage, "test-user-recruiter");
  console.log("\n=== RECHERCHE DE CANDIDATS ===");
  console.log("Réponse:", candidateResponse.response);
  console.log("Type détecté:", candidateResponse.requestType);
  console.log("Candidats trouvés:", candidateResponse.relevantCandidates.length);
})();
*/