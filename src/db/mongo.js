// Accès MongoDB : utilisé uniquement pour le journal d'audit (données volumineuses, structure variable).
import { MongoClient } from 'mongodb';
import config from '../config.js';

let client;
let collectionAudit;

export async function getAuditCollection() {
  if (!collectionAudit) {
    client = new MongoClient(config.mongoUrl, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    collectionAudit = client.db(config.mongoDb).collection('audit_logs');
    await collectionAudit.createIndex({ acteur_id: 1, date: -1 });
    await collectionAudit.createIndex({ action: 1, date: -1 });
    // Index TTL : suppression automatique des événements après la durée de conservation (RGPD).
    await collectionAudit.createIndex({ date: 1 }, { expireAfterSeconds: config.auditRetentionJours * 86400 });
  }
  return collectionAudit;
}

export async function fermerMongo() {
  if (client) await client.close();
  client = undefined;
  collectionAudit = undefined;
}
