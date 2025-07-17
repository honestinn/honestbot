// 📄 /server/services/jobService.js (VERSION CORRIGÉE)
const { MongoClient } = require("mongodb");

// Vérifier l'URI MongoDB
if (!process.env.MONGO_URI) {
  console.error("⚠️  MONGO_URI manquante dans les variables d'environnement");
  console.log("Créez un fichier .env avec : MONGO_URI=mongodb://localhost:27017/honestinn");
}

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/honestinn";
let client;
let isConnected = false;

async function connectToMongo() {
  if (!isConnected) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      writeConcern: {
        w: 'majority'
      }
    });
    
    try {
      await client.connect();
      // Test de la connexion
      await client.db("admin").command({ ping: 1 });
      isConnected = true;
      console.log("✅ Connecté à MongoDB avec succès");
    } catch (error) {
      console.error("❌ Erreur de connexion MongoDB:", error.message);
      // Ne pas throw l'erreur, utiliser les données d'exemple à la place
      console.log("🔄 Utilisation des offres d'exemple...");
    }
  }
  return client;
}

async function findMatchingJobs(message) {
  try {
    // Essayer de se connecter à MongoDB
    if (process.env.MONGO_URI) {
      const client = await connectToMongo();
      
      if (isConnected) {
        const db = client.db("honestinn");
        
        // Recherche améliorée avec mots-clés
        const keywords = extractKeywords(message);
        let query = {};
        
        console.log(`🔍 Recherche avec mots-clés: [${keywords.join(', ')}]`);
        
        if (keywords.length > 0) {
          query = {
            $or: [
              { title: { $regex: keywords.join("|"), $options: "i" } },
              { description: { $regex: keywords.join("|"), $options: "i" } },
              { company: { $regex: keywords.join("|"), $options: "i" } },
              { location: { $regex: keywords.join("|"), $options: "i" } },
              { skills: { $in: keywords } },
              { category: { $in: keywords } }
            ]
          };
        }
        
        const jobs = await db.collection("jobs")
          .find(query)
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray();
        
        console.log(`📊 ${jobs.length} offres trouvées dans MongoDB`);
        
        // Si aucun résultat avec les mots-clés, chercher toutes les offres
        if (jobs.length === 0 && keywords.length > 0) {
          console.log("🔄 Aucun résultat spécifique, recherche générale...");
          const allJobs = await db.collection("jobs")
            .find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();
          
          console.log(`📊 ${allJobs.length} offres générales trouvées`);
          return allJobs.length > 0 ? allJobs : getSampleJobs(message);
        }
        
        return jobs.length > 0 ? jobs : getSampleJobs(message);
      }
    }
    
    // Fallback vers les offres d'exemple
    console.log("🔄 Utilisation des offres d'exemple...");
    return getSampleJobs(message);
    
  } catch (error) {
    console.error("❌ Erreur lors de la recherche d'emplois:", error.message);
    console.log("🔄 Utilisation des offres d'exemple...");
    return getSampleJobs(message);
  }
}

function extractKeywords(message) {
  // Mots vides à ignorer
  const stopWords = [
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'dans', 'et', 'ou', 
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'pour', 'sur',
    'avec', 'sans', 'par', 'ce', 'ces', 'son', 'sa', 'ses', 'mon', 'ma', 'mes',
    'ton', 'ta', 'tes', 'notre', 'votre', 'leur', 'leurs', 'qui', 'que', 'quoi',
    'où', 'quand', 'comment', 'pourquoi', 'cherche', 'recherche', 'veux', 'veut',
    'offre', 'offres', 'emploi', 'emplois', 'poste', 'postes', 'travail', 'job'
  ];
  
  // Synonymes et termes spécialisés
  const synonyms = {
    'serveur': ['serveur', 'serveuse', 'service'],
    'chef': ['chef', 'cuisinier', 'cuisine'],
    'receptionniste': ['réceptionniste', 'réception', 'accueil'],
    'commercial': ['commercial', 'vente', 'business'],
    'manager': ['manager', 'directeur', 'responsable'],
    'barman': ['barman', 'barmaid', 'bar'],
    'ménage': ['ménage', 'housekeeping', 'entretien']
  };
  
  const words = message
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  // Ajouter les synonymes
  const expandedWords = [...words];
  words.forEach(word => {
    Object.entries(synonyms).forEach(([key, syns]) => {
      if (syns.includes(word) && !expandedWords.includes(key)) {
        expandedWords.push(key);
      }
    });
  });
  
  return [...new Set(expandedWords)];
}

// Fonction pour retourner des offres d'exemple si la DB est indisponible
function getSampleJobs(message) {
  const sampleJobs = [
    {
      title: "Serveur/Serveuse - Restaurant Le Bistrot",
      company: "Le Bistrot Parisien",
      location: "Paris 11ème",
      salary: "1800€ - 2200€",
      type: "CDI",
      description: "Recherche serveur expérimenté pour restaurant traditionnel",
      category: "restauration"
    },
    {
      title: "Réceptionniste Hôtel 4 étoiles",
      company: "Hôtel des Grands Boulevards",
      location: "Paris 2ème", 
      salary: "2000€ - 2400€",
      type: "CDI",
      description: "Réceptionniste pour hôtel de luxe, anglais requis",
      category: "hotellerie"
    },
    {
      title: "Chef de Partie - Cuisine Française",
      company: "Restaurant Le Gourmet",
      location: "Lyon",
      salary: "2200€ - 2800€",
      type: "CDI",
      description: "Chef de partie pour cuisine traditionnelle française",
      category: "cuisine"
    },
    {
      title: "Commercial B2B - Secteur Hôtellerie",
      company: "Honest-Inn",
      location: "Paris",
      salary: "3000€ - 4000€ + commissions",
      type: "CDI",
      description: "Développement commercial auprès des professionnels",
      category: "commercial"
    },
    {
      title: "Gouvernante d'étage",
      company: "Hôtel Kyriad",
      location: "Marseille",
      salary: "1700€ - 2000€",
      type: "CDI",
      description: "Responsable propreté et organisation des chambres",
      category: "housekeeping"
    }
  ];
  
  // Filtrer selon le message si possible
  const keywords = extractKeywords(message);
  if (keywords.length > 0) {
    const filtered = sampleJobs.filter(job => {
      const jobText = `${job.title} ${job.description} ${job.category}`.toLowerCase();
      return keywords.some(keyword => jobText.includes(keyword));
    });
    
    if (filtered.length > 0) {
      console.log(`📊 ${filtered.length} offres d'exemple filtrées trouvées`);
      return filtered;
    }
  }
  
  console.log(`📊 ${sampleJobs.slice(0, 3).length} offres d'exemple par défaut`);
  return sampleJobs.slice(0, 3);
}

// Fermeture propre de la connexion
process.on('SIGINT', async () => {
  if (isConnected && client) {
    await client.close();
    console.log('🔌 Connexion MongoDB fermée proprement');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (isConnected && client) {
    await client.close();
    console.log('🔌 Connexion MongoDB fermée proprement');
  }
  process.exit(0);
});

module.exports = { findMatchingJobs };