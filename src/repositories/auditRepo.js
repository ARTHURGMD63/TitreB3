// Journal d'audit dans MongoDB : un document par événement, structure souple (avant / après).
import { getAuditCollection } from '../db/mongo.js';

export async function inserer(evenement) {
  const col = await getAuditCollection();
  await col.insertOne(evenement);
}

// Les valeurs de filtre sont forcées en types simples : empêche l'injection d'opérateurs NoSQL ($ne, $gt...).
export async function rechercher({ acteurId, action, entite, du, au, limite = 50, page = 1 }) {
  const col = await getAuditCollection();
  const filtre = {};
  if (acteurId !== undefined) filtre.acteur_id = Number(acteurId);
  if (action) filtre.action = String(action);
  if (entite) filtre['cible.type'] = String(entite);
  if (du || au) {
    filtre.date = {};
    if (du) filtre.date.$gte = new Date(du);
    if (au) filtre.date.$lte = new Date(au);
  }
  const [elements, total] = await Promise.all([
    col.find(filtre, { projection: { _id: 0 } }).sort({ date: -1 }).skip((page - 1) * limite).limit(limite).toArray(),
    col.countDocuments(filtre)
  ]);
  return { elements, total };
}

export async function exporterPourActeur(acteurId) {
  const col = await getAuditCollection();
  return col.find({ acteur_id: Number(acteurId) }, { projection: { _id: 0 } }).sort({ date: 1 }).toArray();
}

// Droit à l'effacement : on retire l'adresse IP, l'identifiant est conservé de façon pseudonymisée.
export async function pseudonymiserActeur(acteurId) {
  const col = await getAuditCollection();
  await col.updateMany({ acteur_id: Number(acteurId) }, { $unset: { ip: '' }, $set: { pseudonymise: true } });
}
