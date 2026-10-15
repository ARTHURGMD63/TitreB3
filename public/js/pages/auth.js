// Pages d'authentification : connexion, inscription, mot de passe oublié et réinitialisation.
import { api } from '../api.js';
import { annoncer, champ, h, messageErreur, remplacer } from '../dom.js';

function formulaire(titre, champs, libelleBouton, onValider, liens = []) {
  const bouton = h('button', { type: 'submit' }, libelleBouton);
  const erreur = h('p', { role: 'alert', class: 'message-erreur', hidden: true });
  const form = h('form', { novalidate: false, class: 'carte', 'aria-labelledby': 'titre-form' },
    h('h1', { id: 'titre-form' }, titre), champs.map((c) => c.el), erreur, bouton, liens.length ? h('p', {}, liens) : null);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erreur.hidden = true;
    bouton.disabled = true;
    try {
      await onValider(Object.fromEntries(champs.map((c) => [c.input.name, c.input.value])));
    } catch (err) {
      erreur.textContent = messageErreur(err);
      erreur.hidden = false;
    } finally {
      bouton.disabled = false;
    }
  });
  return form;
}

export async function pageConnexion(conteneur, { session }) {
  const email = champ({ label: 'Adresse email', nom: 'email', type: 'email', requis: true, autocomplete: 'username' });
  const mdp = champ({ label: 'Mot de passe', nom: 'mot_de_passe', type: 'password', requis: true, autocomplete: 'current-password' });
  remplacer(conteneur, formulaire('Connexion', [email, mdp], 'Se connecter', async (valeurs) => {
    const { utilisateur } = await api.post('/api/auth/login', valeurs);
    session.utilisateur = utilisateur;
    location.hash = '#/';
  }, [h('a', { href: '#/inscription' }, 'Créer un compte'), ' · ', h('a', { href: '#/mot-de-passe-oublie' }, 'Mot de passe oublié ?')]));
}

export async function pageInscription(conteneur) {
  const champs = [
    champ({ label: 'Prénom', nom: 'prenom', requis: true, autocomplete: 'given-name', maxlength: 80 }),
    champ({ label: 'Nom', nom: 'nom', requis: true, autocomplete: 'family-name', maxlength: 80 }),
    champ({ label: 'Adresse email', nom: 'email', type: 'email', requis: true, autocomplete: 'email' }),
    champ({ label: 'Mot de passe', nom: 'mot_de_passe', type: 'password', requis: true, autocomplete: 'new-password', minlength: 10,
      aide: '10 caractères minimum, avec une majuscule, une minuscule et un chiffre.' })
  ];
  remplacer(conteneur, formulaire('Créer un compte', champs, "S'inscrire", async (valeurs) => {
    await api.post('/api/auth/register', valeurs);
    annoncer('Compte créé, vous pouvez vous connecter.', 'ok');
    location.hash = '#/connexion';
  }, [h('a', { href: '#/connexion' }, 'Déjà inscrit ? Se connecter')]));
}

export async function pageMotDePasseOublie(conteneur) {
  const email = champ({ label: 'Adresse email', nom: 'email', type: 'email', requis: true });
  remplacer(conteneur, formulaire('Mot de passe oublié', [email], 'Envoyer le lien', async (valeurs) => {
    const r = await api.post('/api/auth/forgot-password', valeurs);
    annoncer(r.message, 'ok');
  }, [h('a', { href: '#/connexion' }, 'Retour à la connexion')]));
}

export async function pageReinitialisation(conteneur, { parametres }) {
  const token = parametres.get('token') || '';
  const mdp = champ({ label: 'Nouveau mot de passe', nom: 'mot_de_passe', type: 'password', requis: true, autocomplete: 'new-password', minlength: 10,
    aide: '10 caractères minimum, avec une majuscule, une minuscule et un chiffre.' });
  remplacer(conteneur, formulaire('Nouveau mot de passe', [mdp], 'Enregistrer', async (valeurs) => {
    await api.post('/api/auth/reset-password', { token, mot_de_passe: valeurs.mot_de_passe });
    annoncer('Mot de passe modifié, vous pouvez vous connecter.', 'ok');
    location.hash = '#/connexion';
  }));
}
