import ChatbotWidget from "./components/ChatbotWidget";

function App() {
  return (
    <div className="app">
      {/* Styles CSS intégrés */}
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          background: #ffffff;
        }
        
        .app {
          min-height: 100vh;
        }
        
        /* Header */
        .header {
          background: white;
          border-bottom: 1px solid #f0f0f0;
          padding: 20px 0;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 18px;
        }
        
        .logo-text {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
        }
        
        .nav {
          display: flex;
          gap: 32px;
          align-items: center;
        }
        
        .nav-link {
          color: #666;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }
        
        .nav-link:hover {
          color: #f59e0b;
        }
        
        .nav-buttons {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        
        .btn-secondary {
          padding: 10px 20px;
          border: 1px solid #e5e5e5;
          background: white;
          color: #666;
          border-radius: 25px;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover {
          border-color: #f59e0b;
          color: #f59e0b;
        }
        
        .btn-primary {
          padding: 10px 20px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          border: none;
          border-radius: 25px;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary:hover {
          background: linear-gradient(135deg, #d97706, #b45309);
          transform: translateY(-1px);
        }
        
        /* Hero Section */
        .hero {
          padding: 80px 0 120px;
          background: linear-gradient(135deg, #fef7e6 0%, #fff7ed 100%);
          position: relative;
          overflow: hidden;
        }
        
        .hero::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 50%;
          height: 100%;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="%23f59e0b" opacity="0.1"/><circle cx="80" cy="40" r="1" fill="%23d97706" opacity="0.1"/><circle cx="40" cy="80" r="1.5" fill="%23f59e0b" opacity="0.1"/></svg>');
          opacity: 0.3;
        }
        
        .hero-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }
        
        .hero-content h1 {
          font-size: 56px;
          font-weight: 700;
          line-height: 1.1;
          color: #1a1a1a;
          margin-bottom: 24px;
        }
        
        .hero-content .highlight {
          color: #f59e0b;
        }
        
        .hero-content p {
          font-size: 20px;
          color: #666;
          margin-bottom: 40px;
          line-height: 1.6;
        }
        
        .hero-image {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 25px 50px rgba(0,0,0,0.1);
        }
        
        .hero-image img {
          width: 100%;
          height: 400px;
          object-fit: cover;
        }
        
        .stats-overlay {
          position: absolute;
          top: 20px;
          right: 20px;
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          min-width: 120px;
        }
        
        .stat-item {
          margin-bottom: 12px;
        }
        
        .stat-item:last-child {
          margin-bottom: 0;
        }
        
        .stat-number {
          font-size: 28px;
          font-weight: 700;
          color: #f59e0b;
        }
        
        .stat-label {
          font-size: 14px;
          color: #666;
          font-weight: 500;
        }
        
        /* How it works */
        .how-it-works {
          padding: 120px 0;
          background: white;
        }
        
        .section-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }
        
        .section-header {
          text-align: center;
          margin-bottom: 80px;
        }
        
        .section-header h2 {
          font-size: 42px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 16px;
        }
        
        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }
        
        .features-content {
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 20px;
        }
        
        .feature-icon {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .feature-icon.ai {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
        }
        
        .feature-icon.simple {
          background: linear-gradient(135deg, #f59e0b, #d97706););
          color: white;
        }
        
        .feature-icon.talent {
          background: linear-gradient(135deg, #f59e0b, #d97706););
          color: white;
        }
        
        .feature-content h3 {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        
        .feature-content p {
          color: #666;
          line-height: 1.6;
        }
        
        .features-images {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        
        .feature-image {
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        
        .feature-image img {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }
        
        .feature-image.large {
          grid-column: 1 / -1;
        }
        
        .feature-image.large img {
          height: 250px;
        }
        
        .cta-link {
          color: #f59e0b;
          text-decoration: none;
          font-weight: 600;
          margin-top: 20px;
          display: inline-block;
        }
        
        .cta-link:hover {
          text-decoration: underline;
        }
        
        /* Results */
        .results {
          padding: 120px 0;
          background: #fef7e6;
        }
        
        .results-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          margin-top: 60px;
        }
        
        .result-card {
          background: white;
          padding: 40px 30px;
          border-radius: 20px;
          text-align: center;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        }
        
        .result-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: white;
        }
        
        .result-number {
          font-size: 48px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        
        .result-label {
          color: #666;
          font-weight: 500;
        }
        
        /* Partners */
        .partners {
          padding: 80px 0;
          background: white;
        }
        
        .partners-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 40px;
          margin-top: 60px;
          align-items: center;
        }
        
        .partner-logo {
          text-align: center;
          padding: 20px;
          border-radius: 12px;
          background: #fafafa;
          font-size: 20px;
          font-weight: 600;
          color: #666;
          transition: all 0.2s;
        }
        
        .partner-logo:hover {
          background: #f0f0f0;
          transform: translateY(-2px);
        }
        
        /* Testimonials */
        .testimonials {
          padding: 120px 0;
          background: #fef7e6;
        }
        
        .testimonial-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
          margin-top: 60px;
        }
        
        .testimonial-card {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
          position: relative;
        }
        
        .testimonial-quote {
          font-size: 48px;
          color: #f59e0b;
          position: absolute;
          top: 20px;
          left: 40px;
        }
        
        .testimonial-text {
          font-size: 18px;
          line-height: 1.6;
          color: #666;
          margin: 40px 0 30px;
          font-style: italic;
        }
        
        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .author-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 20px;
        }
        
        .author-info h4 {
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 4px;
        }
        
        .author-info p {
          color: #666;
          font-size: 14px;
        }
        
        /* Footer */
        .footer {
          background: #1a1a1a;
          color: white;
          padding: 80px 0 40px;
        }
        
        .footer-content {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 60px;
          margin-bottom: 60px;
        }
        
        .footer-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .footer-brand .logo-icon {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }
        
        .footer-brand .logo-text {
          color: white;
        }
        
        .footer-description {
          color: #999;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        
        .footer-section h3 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
          color: white;
        }
        
        .footer-links {
          list-style: none;
        }
        
        .footer-links li {
          margin-bottom: 12px;
        }
        
        .footer-links a {
          color: #999;
          text-decoration: none;
          transition: color 0.2s;
        }
        
        .footer-links a:hover {
          color: #f59e0b;
        }
        
        .app-buttons {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }
        
        .app-button {
          padding: 10px 16px;
          background: #333;
          color: white;
          border-radius: 8px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        }
        
        .app-button:hover {
          background: #444;
        }
        
        .footer-bottom {
          border-top: 1px solid #333;
          padding-top: 40px;
          text-align: center;
          color: #666;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .hero-container {
            grid-template-columns: 1fr;
            gap: 40px;
            text-align: center;
          }
          
          .hero-content h1 {
            font-size: 36px;
          }
          
          .features-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          
          .results-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          
          .partners-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          
          .testimonial-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          
          .footer-content {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          
          .nav {
            display: none;
          }
        }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="logo">
            <div className="logo-icon">HI</div>
            <div className="logo-text">HONEST-INN</div>
          </div>
          
          <nav className="nav">
            <a href="#" className="nav-link">Accueil</a>
            <a href="#" className="nav-link">Nos Offres d'emploi</a>
            <a href="#" className="nav-link">Contact</a>
          </nav>
          
          <div className="nav-buttons">
            <a href="#" className="btn-secondary">Se connecter</a>
            <a href="#" className="btn-primary">Devenir partenaire</a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1>
              Le recrutement, <span className="highlight">repensé</span><br />
              pour l'hôtellerie
            </h1>
            <p>
              Simplifiez votre processus de recrutement avec une solution conçue 
              spécifiquement pour les professionnels de l'hôtellerie et de la restauration.
            </p>
            <a href="#" className="btn-primary">Devenir partenaire</a>
          </div>
          
          <div className="hero-image">
            <img src="https://www.google.com/url?sa=i&url=http%3A%2F%2Fwww.mcg-luxury.fr%2Fcabinet_recrutement_et_chasse_de_tetes.htm&psig=AOvVaw2YQ4HIVFF-uoGnviAw9sA0&ust=1748009358969000&source=images&cd=vfe&opi=89978449&ved=0CBQQjRxqFwoTCLijiL2gt40DFQAAAAAdAAAAABAE" alt="Chambre d'hôtel moderne" />
            <div className="stats-overlay">
              <div className="stat-item">
                <div className="stat-number">100%</div>
                <div className="stat-label">Gratuit</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">98%</div>
                <div className="stat-label">Satisfaction</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-it-works">
        <div className="section-container">
          <div className="section-header">
            <h2>Comment ça marche ?</h2>
          </div>
          
          <div className="features-grid">
            <div className="features-content">
              <div className="feature-item">
                <div className="feature-icon ai">🤖</div>
                <div className="feature-content">
                  <h3>IA de matching</h3>
                  <p>Notre algorithme d'intelligence artificielle trouve les candidats idéaux pour votre établissement.</p>
                </div>
              </div>
              
              <div className="feature-item">
                <div className="feature-icon simple">⚡</div>
                <div className="feature-content">
                  <h3>Recrutement simplifié</h3>
                  <p>Un processus de recrutement fluide et intuitif pour vous faire gagner un temps précieux.</p>
                </div>
              </div>
              
              <div className="feature-item">
                <div className="feature-icon talent">⭐</div>
                <div className="feature-content">
                  <h3>Talents d'exception</h3>
                  <p>Accédez à une communauté exclusive de professionnels de l'hôtellerie et de la restauration.</p>
                </div>
              </div>
              
              <a href="#" className="cta-link">Prêt à transformer votre recrutement ? Devenir partenaire</a>
            </div>
            
            <div className="features-images">
              <div className="feature-image">
                <img src="/api/placeholder/250/200" alt="Équipe hôtelière" />
              </div>
              <div className="feature-image">
                <img src="/api/placeholder/250/200" alt="Service restaurant" />
              </div>
              <div className="feature-image large">
                <img src="/api/placeholder/520/250" alt="Réception hôtel" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="results">
        <div className="section-container">
          <div className="section-header">
            <h2>Des résultats concrets</h2>
          </div>
          
          <div className="results-grid">
            <div className="result-card">
              <div className="result-icon">👥</div>
              <div className="result-number">100+</div>
              <div className="result-label">Candidats qualifiés</div>
            </div>
            
            <div className="result-card">
              <div className="result-icon">🏨</div>
              <div className="result-number">15+</div>
              <div className="result-label">Établissements partenaires</div>
            </div>
            
            <div className="result-card">
              <div className="result-icon">⭐</div>
              <div className="result-number">98%</div>
              <div className="result-label">Taux de satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="partners">
        <div className="section-container">
          <div className="section-header">
            <h2>Ils nous ont fait confiance</h2>
          </div>
          
          <div className="partners-grid">
            <div className="partner-logo">Le Méridien</div>
            <div className="partner-logo">Kyriad</div>
            <div className="partner-logo">Helzear Paris</div>
            <div className="partner-logo">LP Hotels</div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="section-container">
          <div className="section-header">
            <h2>Des retours qui en disent long</h2>
          </div>
          
          <div className="testimonial-grid">
            <div className="testimonial-card">
              <div className="testimonial-quote">"</div>
              <p className="testimonial-text">
                Excellent service de la part d'une équipe très honnête. 
                Ils ont su comprendre nos besoins et nous proposer des candidats parfaitement adaptés.
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">MT</div>
                <div className="author-info">
                  <h4>MEZIANE T.</h4>
                  <p>Directeur Hôtelier</p>
                </div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <div className="testimonial-quote">"</div>
              <p className="testimonial-text">
                Une approche moderne du recrutement qui nous fait gagner un temps précieux. 
                L'IA de matching est vraiment impressionnante.
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">SL</div>
                <div className="author-info">
                  <h4>SOPHIE L.</h4>
                  <p>RH Restaurant</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="section-container">
          <div className="footer-content">
            <div>
              <div className="footer-brand">
                <div className="logo-icon">HI</div>
                <div className="logo-text">HONEST-INN</div>
              </div>
              <p className="footer-description">
                Votre source fiable pour l'hôtellerie et la restauration.
              </p>
              <p className="footer-description">Téléchargez notre app !</p>
              <div className="app-buttons">
                <a href="#" className="app-button">Play Store</a>
                <a href="#" className="app-button">App Store</a>
              </div>
            </div>
            
            <div className="footer-section">
              <h3>HONEST-INN</h3>
              <ul className="footer-links">
                <li><a href="#">À Propos</a></li>
                <li><a href="#">Contactez-nous</a></li>
                <li><a href="#">FAQs</a></li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h3>LÉGAL</h3>
              <ul className="footer-links">
                <li><a href="#">Cadre juridique</a></li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h3>CONTACT</h3>
              <ul className="footer-links">
                <li><a href="#">01 83 75 63 26</a></li>
                <li><a href="#">contact@honest-inn.com</a></li>
              </ul>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>© 2025. Tous droits réservés.</p>
          </div>
        </div>
      </footer>

      {/* Widget Chatbot */}
      <ChatbotWidget />
    </div>
  );
}

export default App;