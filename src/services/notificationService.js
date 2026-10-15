// Notifications : enregistrement interne + envoi d'email (Mailhog en développement).
import nodemailer from 'nodemailer';
import config from '../config.js';
import * as notificationRepo from '../repositories/notificationRepo.js';

let transport;
const getTransport = () => (transport ??= nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: false, ignoreTLS: true }));

export async function envoyerEmail(destinataire, sujet, texte) {
  if (config.enTest) return;
  try {
    await getTransport().sendMail({ from: config.mailFrom, to: destinataire, subject: sujet, text: texte });
  } catch (err) {
    console.error(`Email non envoyé (${sujet}) :`, err.message);
  }
}

// Ne lève jamais d'erreur : une notification ratée ne doit pas annuler une réservation.
export async function notifier(utilisateur, type, sujet, message) {
  try {
    await notificationRepo.creer(utilisateur.id, type, message);
  } catch (err) {
    console.error('Notification interne non enregistrée :', err.message);
  }
  await envoyerEmail(utilisateur.email, sujet, message);
}

export const lister = (utilisateurId) => notificationRepo.lister(utilisateurId);
export const toutMarquerLu = (utilisateurId) => notificationRepo.toutMarquerLu(utilisateurId);
