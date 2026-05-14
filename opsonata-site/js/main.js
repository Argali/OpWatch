/* ── OpSonata site — main.js ─────────────────── */

// ── i18n ─────────────────────────────────────
const TRANSLATIONS = {
  it: {
    'nav.modules': 'Moduli',
    'nav.how': 'Come Funziona',
    'nav.screenshots': 'Screenshots',
    'nav.contact': 'Contatti',
    'nav.demo': 'Richiedi Demo',
    'nav.platform': 'Accedi alla Piattaforma',
    'hero.badge': 'Flotta connessa in tempo reale',
    'hero.title': 'Gestisci la tua<br><span class="line-green">flotta veicoli</span><br><span class="line-blue">ovunque tu sia</span>',
    'hero.sub': 'OpSonata è la piattaforma integrata per il monitoraggio GPS, la pianificazione dei percorsi, la gestione dei conducenti e l\'analisi delle performance. Tutto in un\'unica interfaccia web.',
    'hero.cta1': 'Richiedi una Demo',
    'hero.cta2': 'Scopri i Moduli',
    'trust.label': 'Tecnologie integrate',
    'section.modules.label': 'Piattaforma modulare',
    'section.modules.title': 'Tutto ciò di cui hai bisogno,<br><span>in un\'unica piattaforma</span>',
    'section.modules.sub': 'OpSonata combina monitoraggio GPS, pianificazione percorsi, gestione flotta e analisi dati in un\'interfaccia coerente e accessibile da qualsiasi dispositivo.',
    'mod.map.title': 'Mappa Live',
    'mod.map.desc': 'Visualizza la posizione di tutta la flotta in tempo reale su mappa interattiva. Clustering automatico, filtri per stato veicolo, cronologia tracce GPS e navigazione street-level.',
    'mod.routes.title': 'Editor Percorsi',
    'mod.routes.desc': 'Pianifica e ottimizza i percorsi di consegna con waypoint trascinabili, snapping automatico alla rete stradale, annotazioni sulla mappa e esportazione PDF professionale.',
    'mod.fleet.title': 'Gestione Flotta',
    'mod.fleet.desc': 'Registro completo dei veicoli: targa, marca, modello, assegnazione conducente, scadenze di manutenzione, km percorsi e stato operativo. Menu rapido direttamente sulla mappa.',
    'mod.analytics.title': 'Analytics & Report',
    'mod.analytics.desc': 'Dashboard con grafici interattivi per km percorsi, consumi, sostituzioni, performance per conducente e confronti periodo su periodo. Esportazione dati in PDF e CSV.',
    'mod.weather.title': 'Overlay Meteo',
    'mod.weather.desc': 'Layer meteo sovrapposti alla mappa operativa: temperatura (°C), precipitazioni e intensità del vento. Alimentati da OpenWeatherMap, aggiornati in tempo reale.',
    'mod.auth.title': 'Autenticazione Azure',
    'mod.auth.desc': 'Integrazione nativa con Microsoft Azure Active Directory (MSAL). Single Sign-On aziendale, gestione ruoli, sessioni sicure e nessuna password da gestire internamente.',
    'how.label': 'Processo semplice',
    'how.title': 'Operativo in <span>tre passi</span>',
    'how.sub': 'Nessuna installazione client, nessuna configurazione complessa. OpSonata è una web app — accedi dal browser e sei operativo in minuti.',
    'step1.title': 'Configura i veicoli',
    'step1.desc': 'Aggiungi i tuoi camion con targa, modello e dispositivo GPS. Importazione massiva da CSV supportata.',
    'step2.title': 'Monitora in tempo reale',
    'step2.desc': 'La mappa live si aggiorna ogni 30 secondi con la posizione precisa di ogni veicolo e il suo stato operativo.',
    'step3.title': 'Pianifica e ottimizza',
    'step3.desc': 'Usa l\'editor percorsi per disegnare route ottimizzate e assegnarle ai conducenti direttamente dalla piattaforma.',
    'step4.title': 'Analizza le performance',
    'step4.desc': 'Report automatici su km, consumi e puntualità ti aiutano a ridurre i costi e migliorare il servizio nel tempo.',
    'hl.label': 'Perché OpSonata',
    'hl.title': 'Progettato per chi lavora<br><span>sul territorio ogni giorno</span>',
    'hl.sub': 'OpSonata nasce dall\'esigenza concreta di chi gestisce flotte di veicoli commerciali in contesti complessi.',
    'hl.item1': 'Interfaccia web — nessuna app da installare sui dispositivi aziendali',
    'hl.item2': 'Dark mode nativa con toggle light/dark, rispetta le preferenze di sistema',
    'hl.item3': 'PWA installabile — funziona offline con dati cached',
    'hl.item4': 'Sicurezza enterprise con Azure AD e Single Sign-On',
    'hl.item5': 'Export PDF direttamente dalla mappa, pronto per stampa e archivio',
    'hl.item6': 'Integrazione meteo per pianificare le consegne in sicurezza',
    'hl.item7': 'Supporto multi-lingua (Italiano, Inglese, Francese)',
    'sc.label': 'Interfaccia',
    'sc.title': 'Vedi OpSonata in <span>azione</span>',
    'sc.sub': 'Un\'interfaccia pulita, dark-first, progettata per essere usata tutto il giorno senza affaticare la vista. Responsive su desktop, tablet e mobile.',
    'sc.map.desc': 'Mappa Live — Monitoraggio flotta in tempo reale con clustering, tracce GPS e menu veicoli',
    'sc.map.label': 'Mappa Live — Vista flotta completa',
    'sc.routes.desc': 'Editor Percorsi — Disegna route con waypoints e snap-to-road',
    'sc.routes.label': 'Editor Percorsi',
    'sc.analytics.desc': 'Dashboard Analytics — KPI, grafici e report esportabili',
    'sc.analytics.label': 'Analytics & Report',
    'sc.weather.desc': 'Overlay Meteo — Layer temperatura, pioggia e vento sulla mappa',
    'sc.weather.label': 'Overlay Meteo',
    'sc.fleet.desc': 'Registro Flotta — Scheda veicolo con storico km e manutenzioni',
    'sc.fleet.label': 'Gestione Flotta',
    'contact.label': 'Parliamoci',
    'contact.title': 'Richiedi una <span>demo gratuita</span>',
    'contact.sub': 'Compila il form e ti ricontatteremo entro 24 ore per una demo personalizzata della piattaforma adatta alla tua flotta.',
    'contact.address.title': 'Sede',
    'contact.address.val': 'Via Lorem Ipsum, 42<br>20100 Milano (MI), Italia',
    'contact.email.title': 'Email',
    'contact.phone.title': 'Telefono',
    'contact.hours.title': 'Orari supporto',
    'contact.hours.val': 'Lun–Ven, 9:00–18:00 CET',
    'contact.existing': '<strong style="color:var(--text)">Hai già un\'installazione?</strong><br>Per il supporto tecnico scrivi a <a href="mailto:support@opsonata.com" style="color:var(--blue)">support@opsonata.com</a> oppure apri un ticket nel portale clienti.',
    'form.fname': 'Nome *',
    'form.lname': 'Cognome *',
    'form.fname.ph': 'Mario',
    'form.lname.ph': 'Rossi',
    'form.email': 'Email aziendale *',
    'form.email.ph': 'mario.rossi@azienda.it',
    'form.company': 'Azienda *',
    'form.company.ph': 'Trasporti Rossi Srl',
    'form.fleet': 'Dimensione flotta',
    'form.fleet.opt0': 'Seleziona…',
    'form.fleet.opt1': '1 – 10 veicoli',
    'form.fleet.opt2': '11 – 50 veicoli',
    'form.fleet.opt3': '51 – 200 veicoli',
    'form.fleet.opt4': '200+ veicoli',
    'form.phone': 'Telefono',
    'form.phone.ph': '+39 02 000 000',
    'form.message': 'Note aggiuntive',
    'form.message.ph': 'Descrivi brevemente la tua esigenza…',
    'form.gdpr': 'Ho letto e accetto la <a href="privacy.html">Privacy Policy</a> e acconsento al trattamento dei miei dati personali ai sensi del GDPR (Reg. UE 2016/679). *',
    'form.submit': 'Invia Richiesta Demo',
    'form.sending': 'Invio in corso…',
    'form.success.title': 'Richiesta inviata!',
    'form.success.sub': 'Ti ricontatteremo entro 24 ore lavorative.',
    'footer.brand.desc': 'Piattaforma web per la gestione integrata di flotte veicoli, monitoraggio GPS e pianificazione percorsi. Sviluppata da Cauto.',
    'footer.platform': 'Piattaforma',
    'footer.company': 'Azienda',
    'footer.legal': 'Legale',
    'footer.company.about': 'Chi siamo',
    'footer.company.contact': 'Contatti',
    'footer.company.demo': 'Richiedi Demo',
    'footer.legal.privacy': 'Privacy Policy',
    'footer.legal.cookie': 'Cookie Policy',
    'footer.legal.gdpr': 'Diritti GDPR',
    'footer.legal.terms': 'Termini di servizio',
    'footer.legal.notes': 'Note legali',
    'footer.copy': '© 2025 Cauto Srl — OpSonata. Tutti i diritti riservati. P.IVA IT00000000000',
    'cookie.text': 'Utilizziamo cookie tecnici necessari al funzionamento del sito. Leggi la nostra <a href="cookies.html">Cookie Policy</a> e la <a href="privacy.html">Privacy Policy</a>.',
    'cookie.decline': 'Solo necessari',
    'cookie.accept': 'Accetta',
  },

  fr: {
    'nav.modules': 'Modules',
    'nav.how': 'Comment ça marche',
    'nav.screenshots': 'Captures d\'écran',
    'nav.contact': 'Contact',
    'nav.demo': 'Demander une démo',
    'nav.platform': 'Accéder à la plateforme',
    'hero.badge': 'Flotte connectée en temps réel',
    'hero.title': 'Gérez votre<br><span class="line-green">flotte de véhicules</span><br><span class="line-blue">où que vous soyez</span>',
    'hero.sub': 'OpSonata est la plateforme intégrée pour le suivi GPS, la planification des itinéraires, la gestion des conducteurs et l\'analyse des performances. Tout dans une seule interface web.',
    'hero.cta1': 'Demander une démo',
    'hero.cta2': 'Découvrir les modules',
    'trust.label': 'Technologies intégrées',
    'section.modules.label': 'Plateforme modulaire',
    'section.modules.title': 'Tout ce dont vous avez besoin,<br><span>en une seule plateforme</span>',
    'section.modules.sub': 'OpSonata combine le suivi GPS, la planification d\'itinéraires, la gestion de flotte et l\'analyse de données dans une interface cohérente accessible depuis n\'importe quel appareil.',
    'mod.map.title': 'Carte en direct',
    'mod.map.desc': 'Visualisez la position de toute la flotte en temps réel sur une carte interactive. Clustering automatique, filtres par état du véhicule, historique des traces GPS et navigation street-level.',
    'mod.routes.title': 'Éditeur d\'itinéraires',
    'mod.routes.desc': 'Planifiez et optimisez les itinéraires de livraison avec des waypoints déplaçables, l\'accrochage automatique au réseau routier, des annotations sur la carte et l\'export PDF professionnel.',
    'mod.fleet.title': 'Gestion de flotte',
    'mod.fleet.desc': 'Registre complet des véhicules : plaque, marque, modèle, assignation du conducteur, échéances de maintenance, km parcourus et état opérationnel. Menu rapide directement sur la carte.',
    'mod.analytics.title': 'Analytics & Rapports',
    'mod.analytics.desc': 'Tableau de bord avec graphiques interactifs pour les km parcourus, consommations, remplacements, performance par conducteur et comparaisons période par période. Export en PDF et CSV.',
    'mod.weather.title': 'Overlay Météo',
    'mod.weather.desc': 'Couches météo superposées à la carte opérationnelle : température (°C), précipitations et intensité du vent. Alimentées par OpenWeatherMap, mises à jour en temps réel.',
    'mod.auth.title': 'Authentification Azure',
    'mod.auth.desc': 'Intégration native avec Microsoft Azure Active Directory (MSAL). Single Sign-On entreprise, gestion des rôles, sessions sécurisées et aucun mot de passe à gérer en interne.',
    'how.label': 'Processus simple',
    'how.title': 'Opérationnel en <span>trois étapes</span>',
    'how.sub': 'Aucune installation client, aucune configuration complexe. OpSonata est une application web — accédez depuis le navigateur et soyez opérationnel en quelques minutes.',
    'step1.title': 'Configurez vos véhicules',
    'step1.desc': 'Ajoutez vos camions avec plaque, modèle et appareil GPS. Import massif depuis CSV supporté.',
    'step2.title': 'Surveillez en temps réel',
    'step2.desc': 'La carte en direct se met à jour toutes les 30 secondes avec la position précise de chaque véhicule et son état opérationnel.',
    'step3.title': 'Planifiez et optimisez',
    'step3.desc': 'Utilisez l\'éditeur d\'itinéraires pour tracer des routes optimisées et les assigner aux conducteurs directement depuis la plateforme.',
    'step4.title': 'Analysez les performances',
    'step4.desc': 'Les rapports automatiques sur les km, consommations et ponctualité vous aident à réduire les coûts et améliorer le service dans le temps.',
    'hl.label': 'Pourquoi OpSonata',
    'hl.title': 'Conçu pour ceux qui travaillent<br><span>sur le terrain chaque jour</span>',
    'hl.sub': 'OpSonata est né du besoin concret de ceux qui gèrent des flottes de véhicules commerciaux dans des contextes complexes.',
    'hl.item1': 'Interface web — aucune app à installer sur les appareils d\'entreprise',
    'hl.item2': 'Mode sombre natif avec basculement clair/sombre, respecte les préférences système',
    'hl.item3': 'PWA installable — fonctionne hors ligne avec données en cache',
    'hl.item4': 'Sécurité entreprise avec Azure AD et Single Sign-On',
    'hl.item5': 'Export PDF directement depuis la carte, prêt pour l\'impression et l\'archivage',
    'hl.item6': 'Intégration météo pour planifier les livraisons en toute sécurité',
    'hl.item7': 'Support multilingue (Italien, Anglais, Français)',
    'sc.label': 'Interface',
    'sc.title': 'Voir OpSonata en <span>action</span>',
    'sc.sub': 'Une interface épurée, dark-first, conçue pour être utilisée toute la journée sans fatiguer la vue. Responsive sur desktop, tablette et mobile.',
    'sc.map.desc': 'Carte en direct — Surveillance de la flotte en temps réel avec clustering, traces GPS et menu véhicules',
    'sc.map.label': 'Carte en direct — Vue flotte complète',
    'sc.routes.desc': 'Éditeur d\'itinéraires — Tracez des routes avec waypoints et snap-to-road',
    'sc.routes.label': 'Éditeur d\'itinéraires',
    'sc.analytics.desc': 'Tableau de bord Analytics — KPI, graphiques et rapports exportables',
    'sc.analytics.label': 'Analytics & Rapports',
    'sc.weather.desc': 'Overlay Météo — Couches température, pluie et vent sur la carte',
    'sc.weather.label': 'Overlay Météo',
    'sc.fleet.desc': 'Registre de flotte — Fiche véhicule avec historique km et maintenances',
    'sc.fleet.label': 'Gestion de flotte',
    'contact.label': 'Parlons-nous',
    'contact.title': 'Demandez une <span>démo gratuite</span>',
    'contact.sub': 'Remplissez le formulaire et nous vous recontacterons dans les 24 heures pour une démo personnalisée de la plateforme adaptée à votre flotte.',
    'contact.address.title': 'Siège',
    'contact.address.val': 'Via Lorem Ipsum, 42<br>20100 Milano (MI), Italie',
    'contact.email.title': 'Email',
    'contact.phone.title': 'Téléphone',
    'contact.hours.title': 'Horaires support',
    'contact.hours.val': 'Lun–Ven, 9:00–18:00 CET',
    'contact.existing': '<strong style="color:var(--text)">Vous avez déjà une installation ?</strong><br>Pour le support technique, écrivez à <a href="mailto:support@opsonata.com" style="color:var(--blue)">support@opsonata.com</a> ou ouvrez un ticket dans le portail clients.',
    'form.fname': 'Prénom *',
    'form.lname': 'Nom *',
    'form.fname.ph': 'Jean',
    'form.lname.ph': 'Dupont',
    'form.email': 'Email professionnel *',
    'form.email.ph': 'jean.dupont@entreprise.fr',
    'form.company': 'Entreprise *',
    'form.company.ph': 'Transports Dupont SAS',
    'form.fleet': 'Taille de la flotte',
    'form.fleet.opt0': 'Sélectionnez…',
    'form.fleet.opt1': '1 – 10 véhicules',
    'form.fleet.opt2': '11 – 50 véhicules',
    'form.fleet.opt3': '51 – 200 véhicules',
    'form.fleet.opt4': '200+ véhicules',
    'form.phone': 'Téléphone',
    'form.phone.ph': '+33 1 00 00 00 00',
    'form.message': 'Notes supplémentaires',
    'form.message.ph': 'Décrivez brièvement votre besoin…',
    'form.gdpr': 'J\'ai lu et accepte la <a href="privacy.html">Politique de confidentialité</a> et consens au traitement de mes données personnelles conformément au RGPD (Règl. UE 2016/679). *',
    'form.submit': 'Envoyer la demande de démo',
    'form.sending': 'Envoi en cours…',
    'form.success.title': 'Demande envoyée !',
    'form.success.sub': 'Nous vous recontacterons dans les 24 heures ouvrables.',
    'footer.brand.desc': 'Plateforme web pour la gestion intégrée de flottes de véhicules, suivi GPS et planification d\'itinéraires. Développée par Cauto.',
    'footer.platform': 'Plateforme',
    'footer.company': 'Entreprise',
    'footer.legal': 'Légal',
    'footer.company.about': 'À propos',
    'footer.company.contact': 'Contact',
    'footer.company.demo': 'Demander une démo',
    'footer.legal.privacy': 'Politique de confidentialité',
    'footer.legal.cookie': 'Politique des cookies',
    'footer.legal.gdpr': 'Droits RGPD',
    'footer.legal.terms': 'Conditions d\'utilisation',
    'footer.legal.notes': 'Mentions légales',
    'footer.copy': '© 2025 Cauto Srl — OpSonata. Tous droits réservés.',
    'cookie.text': 'Nous utilisons des cookies techniques nécessaires au fonctionnement du site. Lisez notre <a href="cookies.html">Politique des cookies</a> et notre <a href="privacy.html">Politique de confidentialité</a>.',
    'cookie.decline': 'Nécessaires seulement',
    'cookie.accept': 'Accepter',
  },

  en: {
    'nav.modules': 'Modules',
    'nav.how': 'How It Works',
    'nav.screenshots': 'Screenshots',
    'nav.contact': 'Contact',
    'nav.demo': 'Request a Demo',
    'nav.platform': 'Access the Platform',
    'hero.badge': 'Fleet connected in real time',
    'hero.title': 'Manage your<br><span class="line-green">vehicle fleet</span><br><span class="line-blue">from anywhere</span>',
    'hero.sub': 'OpSonata is the integrated platform for GPS tracking, route planning, driver management and performance analytics. All in a single web interface.',
    'hero.cta1': 'Request a Demo',
    'hero.cta2': 'Explore Modules',
    'trust.label': 'Integrated technologies',
    'section.modules.label': 'Modular platform',
    'section.modules.title': 'Everything you need,<br><span>in one platform</span>',
    'section.modules.sub': 'OpSonata combines GPS tracking, route planning, fleet management and data analytics in a coherent interface accessible from any device.',
    'mod.map.title': 'Live Map',
    'mod.map.desc': 'View the entire fleet\'s position in real time on an interactive map. Automatic clustering, filters by vehicle status, GPS track history and street-level navigation.',
    'mod.routes.title': 'Route Editor',
    'mod.routes.desc': 'Plan and optimize delivery routes with draggable waypoints, automatic road snapping, map annotations and professional PDF export.',
    'mod.fleet.title': 'Fleet Management',
    'mod.fleet.desc': 'Complete vehicle registry: plate, make, model, driver assignment, maintenance deadlines, km driven and operational status. Quick menu directly on the map.',
    'mod.analytics.title': 'Analytics & Reports',
    'mod.analytics.desc': 'Dashboard with interactive charts for km driven, fuel consumption, replacements, per-driver performance and period-over-period comparisons. Data export in PDF and CSV.',
    'mod.weather.title': 'Weather Overlay',
    'mod.weather.desc': 'Weather layers overlaid on the operational map: temperature (°C), precipitation and wind intensity. Powered by OpenWeatherMap, updated in real time.',
    'mod.auth.title': 'Azure Authentication',
    'mod.auth.desc': 'Native integration with Microsoft Azure Active Directory (MSAL). Enterprise Single Sign-On, role management, secure sessions and no passwords to manage internally.',
    'how.label': 'Simple process',
    'how.title': 'Up and running in <span>three steps</span>',
    'how.sub': 'No client installation, no complex configuration. OpSonata is a web app — access it from your browser and be operational in minutes.',
    'step1.title': 'Set up your vehicles',
    'step1.desc': 'Add your trucks with plate, model and GPS device. Bulk import from CSV supported.',
    'step2.title': 'Monitor in real time',
    'step2.desc': 'The live map updates every 30 seconds with the precise position of each vehicle and its operational status.',
    'step3.title': 'Plan and optimize',
    'step3.desc': 'Use the route editor to draw optimized routes and assign them to drivers directly from the platform.',
    'step4.title': 'Analyse performance',
    'step4.desc': 'Automated reports on km, fuel consumption and punctuality help you reduce costs and improve service over time.',
    'hl.label': 'Why OpSonata',
    'hl.title': 'Built for those who work<br><span>in the field every day</span>',
    'hl.sub': 'OpSonata was born from the concrete need of those who manage commercial vehicle fleets in complex environments.',
    'hl.item1': 'Web interface — no app to install on company devices',
    'hl.item2': 'Native dark mode with light/dark toggle, respects system preferences',
    'hl.item3': 'Installable PWA — works offline with cached data',
    'hl.item4': 'Enterprise security with Azure AD and Single Sign-On',
    'hl.item5': 'PDF export directly from the map, ready for printing and archiving',
    'hl.item6': 'Weather integration to plan deliveries safely',
    'hl.item7': 'Multi-language support (Italian, English, French)',
    'sc.label': 'Interface',
    'sc.title': 'See OpSonata in <span>action</span>',
    'sc.sub': 'A clean, dark-first interface designed to be used all day without eye strain. Responsive on desktop, tablet and mobile.',
    'sc.map.desc': 'Live Map — Real-time fleet monitoring with clustering, GPS tracks and vehicle menu',
    'sc.map.label': 'Live Map — Full fleet view',
    'sc.routes.desc': 'Route Editor — Draw routes with waypoints and snap-to-road',
    'sc.routes.label': 'Route Editor',
    'sc.analytics.desc': 'Analytics Dashboard — KPIs, charts and exportable reports',
    'sc.analytics.label': 'Analytics & Reports',
    'sc.weather.desc': 'Weather Overlay — Temperature, rain and wind layers on the map',
    'sc.weather.label': 'Weather Overlay',
    'sc.fleet.desc': 'Fleet Registry — Vehicle card with km history and maintenance',
    'sc.fleet.label': 'Fleet Management',
    'contact.label': 'Let\'s talk',
    'contact.title': 'Request a <span>free demo</span>',
    'contact.sub': 'Fill in the form and we\'ll get back to you within 24 hours for a personalised demo of the platform tailored to your fleet.',
    'contact.address.title': 'Office',
    'contact.address.val': 'Via Lorem Ipsum, 42<br>20100 Milano (MI), Italy',
    'contact.email.title': 'Email',
    'contact.phone.title': 'Phone',
    'contact.hours.title': 'Support hours',
    'contact.hours.val': 'Mon–Fri, 9:00–18:00 CET',
    'contact.existing': '<strong style="color:var(--text)">Already a customer?</strong><br>For technical support write to <a href="mailto:support@opsonata.com" style="color:var(--blue)">support@opsonata.com</a> or open a ticket in the client portal.',
    'form.fname': 'First name *',
    'form.lname': 'Last name *',
    'form.fname.ph': 'John',
    'form.lname.ph': 'Smith',
    'form.email': 'Business email *',
    'form.email.ph': 'john.smith@company.com',
    'form.company': 'Company *',
    'form.company.ph': 'Smith Logistics Ltd',
    'form.fleet': 'Fleet size',
    'form.fleet.opt0': 'Select…',
    'form.fleet.opt1': '1 – 10 vehicles',
    'form.fleet.opt2': '11 – 50 vehicles',
    'form.fleet.opt3': '51 – 200 vehicles',
    'form.fleet.opt4': '200+ vehicles',
    'form.phone': 'Phone',
    'form.phone.ph': '+44 20 0000 0000',
    'form.message': 'Additional notes',
    'form.message.ph': 'Briefly describe your needs…',
    'form.gdpr': 'I have read and accept the <a href="privacy.html">Privacy Policy</a> and consent to the processing of my personal data under GDPR (EU Reg. 2016/679). *',
    'form.submit': 'Send Demo Request',
    'form.sending': 'Sending…',
    'form.success.title': 'Request sent!',
    'form.success.sub': 'We\'ll get back to you within 24 business hours.',
    'footer.brand.desc': 'Web platform for integrated fleet management, GPS tracking and route planning. Developed by Cauto.',
    'footer.platform': 'Platform',
    'footer.company': 'Company',
    'footer.legal': 'Legal',
    'footer.company.about': 'About us',
    'footer.company.contact': 'Contact',
    'footer.company.demo': 'Request a Demo',
    'footer.legal.privacy': 'Privacy Policy',
    'footer.legal.cookie': 'Cookie Policy',
    'footer.legal.gdpr': 'GDPR Rights',
    'footer.legal.terms': 'Terms of service',
    'footer.legal.notes': 'Legal notices',
    'footer.copy': '© 2025 Cauto Srl — OpSonata. All rights reserved.',
    'cookie.text': 'We use technical cookies necessary for the website to function. Read our <a href="cookies.html">Cookie Policy</a> and <a href="privacy.html">Privacy Policy</a>.',
    'cookie.decline': 'Necessary only',
    'cookie.accept': 'Accept',
  },
};

const LANG_KEY = 'OpSonata.lang';
let currentLang = localStorage.getItem(LANG_KEY) || 'it';

function applyLang(lang) {
  const t = TRANSLATIONS[lang];
  if (!t) return;
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;

  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // innerHTML (for elements with <br>, <span>, <a> inside)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (t[key] !== undefined) el.placeholder = t[key];
  });

  // Active button state
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

// Language switcher buttons
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

// Apply on load
applyLang(currentLang);

// ── Nav scroll state ─────────────────────────
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav?.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── Mobile menu ──────────────────────────────
const hamburger  = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu?.classList.toggle('open');
});

mobileMenu?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger?.classList.remove('open');
    mobileMenu?.classList.remove('open');
  });
});

// ── Scroll-triggered animations ───────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const delay = entry.target.dataset.delay || 0;
      setTimeout(() => entry.target.classList.add('in-view'), Number(delay));
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

// ── Contact form ──────────────────────────────
const contactForm = document.getElementById('contact-form');
contactForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn     = contactForm.querySelector('button[type="submit"]');
  const success = document.getElementById('form-success');
  const t       = TRANSLATIONS[currentLang];

  btn.disabled    = true;
  btn.textContent = t['form.sending'] || 'Sending…';

  setTimeout(() => {
    contactForm.style.display = 'none';
    if (success) success.style.display = 'block';
  }, 1200);
});

// ── Cookie banner ─────────────────────────────
const cookieBanner  = document.getElementById('cookie-banner');
const cookieAccept  = document.getElementById('cookie-accept');
const cookieDecline = document.getElementById('cookie-decline');
const COOKIE_KEY    = 'OpSonata.cookie-consent';

if (cookieBanner && !localStorage.getItem(COOKIE_KEY)) {
  setTimeout(() => cookieBanner.classList.add('visible'), 800);
}

cookieAccept?.addEventListener('click', () => {
  localStorage.setItem(COOKIE_KEY, 'accepted');
  cookieBanner?.classList.remove('visible');
});

cookieDecline?.addEventListener('click', () => {
  localStorage.setItem(COOKIE_KEY, 'declined');
  cookieBanner?.classList.remove('visible');
});

// ── Counter animation ─────────────────────────
function animateCounter(el, end, duration = 1400) {
  const start  = performance.now();
  const suffix = el.dataset.suffix || '';
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(end * easeOut(progress)).toLocaleString('it-IT') + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('[data-count]').forEach(el => {
        animateCounter(el, Number(el.dataset.count), 1600);
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.hero-stats').forEach(el => statsObserver.observe(el));

// ── Active nav link on scroll ─────────────────
const sections   = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => {
        a.style.color = a.getAttribute('href') === '#' + entry.target.id
          ? 'var(--text)' : '';
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));
