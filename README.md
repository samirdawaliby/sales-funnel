# 🎯 Sales Funnel Caplogy - Formations IT Certifiantes

Landing page de capture de leads pour vendre des formations professionnelles CompTIA, Microsoft, Cisco avec bons d'examen inclus.

## 🎨 Design

**Palette de couleurs Caplogy:**
- Bleu Principal: `#0D3866`
- Cyan Accent: `#00eaff`
- Bleu Clair: `#4cc9ff`
- Vert Succès: `#48BB78`
- Gris Texte: `#718096`

## 📁 Structure Actuelle

```
sales_funnel/
├── index.html          # Landing page avec formulaire de capture
└── README.md           # Documentation
```

## 🚀 Prochaines Étapes

### Phase 1 : Backend (Cloudflare Workers + D1)
- [ ] API endpoint pour capture de leads
- [ ] Intégration Resend pour emails automatiques
- [ ] Base de données D1 pour stocker les leads
- [ ] Système de tracking UTM

### Phase 2 : Email Automation (Resend)
- [ ] Séquence d'onboarding (5 emails)
- [ ] Email #1: Guide PDF "Quelle certification choisir?"
- [ ] Email #2: Témoignages et études de cas
- [ ] Email #3: Calculateur ROI formation
- [ ] Email #4: Offre spéciale avec urgence
- [ ] Email #5: Dernier rappel

### Phase 3 : Pages Supplémentaires
- [ ] Page de vente par certification (CompTIA A+, Security+, etc.)
- [ ] Page checkout avec Stripe
- [ ] Page de remerciement + upsell
- [ ] Dashboard partenaire (tracking commissions bons d'examen)

### Phase 4 : Optimisation
- [ ] A/B testing des titres
- [ ] Pixels de tracking (Facebook, Google Ads)
- [ ] Analytics Cloudflare
- [ ] Quiz interactif "Quelle certification pour vous?"

## 💡 Fonctionnalités du Prototype

✅ **Lead Magnet**: Guide gratuit + Roadmap personnalisée
✅ **Formulaire segmenté**: Niveau + Objectif (pour personnalisation emails)
✅ **Design responsive**: Mobile-friendly
✅ **Palette Caplogy**: Respect de l'identité visuelle
✅ **Trust badges**: Social proof (500+ certifiés, 95% réussite)
✅ **6 certifications principales** mises en avant

## 🛠️ Stack Technique Recommandée

**Frontend:**
- Next.js 14+ (App Router)
- Tailwind CSS (optionnel, actuellement vanilla CSS)

**Backend:**
- Cloudflare Workers (API serverless)
- Cloudflare D1 (base de données SQLite)
- Resend (envoi emails)

**Paiement:**
- Stripe Checkout

**Hosting:**
- Cloudflare Pages (gratuit, CDN global)

**Repository:**
- GitHub/GitLab

## 📧 Intégration Resend (à faire)

```javascript
// Exemple d'intégration Resend dans Cloudflare Worker
import { Resend } from 'resend';

const resend = new Resend(env.RESEND_API_KEY);

await resend.emails.send({
  from: 'formations@caplogy.com',
  to: lead.email,
  subject: '🎓 Votre Guide: Quelle Certification IT Choisir?',
  html: emailTemplate,
});
```

## 🗄️ Schema Base de Données D1

```sql
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prenom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  niveau TEXT,
  objectif TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email_sequence_step INTEGER DEFAULT 0,
  converted BOOLEAN DEFAULT 0
);

CREATE TABLE conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  certification TEXT,
  montant DECIMAL(10,2),
  commission_bon_examen DECIMAL(10,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(lead_id) REFERENCES leads(id)
);
```

## 📊 Objectifs du Funnel

1. **Capture**: 1000 leads/mois
2. **Conversion email → consultation**: 15%
3. **Conversion consultation → vente**: 30%
4. **Marge bons d'examen**: Variable selon partenariat Caplogy

## 🔗 Liens Utiles

- **Cloudflare Pages**: https://pages.cloudflare.com/
- **Resend Docs**: https://resend.com/docs
- **Cloudflare D1**: https://developers.cloudflare.com/d1/
- **Stripe Checkout**: https://stripe.com/docs/payments/checkout

## 📝 Notes

- Le formulaire est fonctionnel mais nécessite l'intégration backend
- Les couleurs respectent exactement la charte graphique Caplogy
- Le design est optimisé pour la conversion (CTA visible, social proof, urgence)
- Mobile-first responsive

## ⚡ Lancement Rapide

Pour tester localement:

```bash
# Ouvrir simplement index.html dans un navigateur
open index.html

# Ou avec un serveur local
python3 -m http.server 8000
# Puis ouvrir http://localhost:8000
```

---

**Prêt à déployer sur Cloudflare Pages en 1 clic !** 🚀
