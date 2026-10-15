// Configuration centralisée, lue depuis les variables d'environnement.
const env = process.env;
const enProduction = env.NODE_ENV === 'production';

const config = {
  enProduction,
  enTest: env.NODE_ENV === 'test',
  port: Number(env.PORT || 3000),
  appUrl: env.APP_URL || 'http://localhost:3000',
  fuseau: env.TZ_APP || 'Europe/Paris',
  databaseUrl: env.DATABASE_URL,
  mongoUrl: env.MONGO_URL || 'mongodb://localhost:27017',
  mongoDb: env.MONGO_DB || 'reservation_audit',
  auditRetentionJours: Number(env.AUDIT_RETENTION_DAYS || 365),
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '2h',
  loginMaxEchecs: Number(env.LOGIN_MAX_ATTEMPTS || 5),
  loginVerrouMinutes: Number(env.LOGIN_LOCK_MINUTES || 15),
  smtp: { host: env.SMTP_HOST || 'localhost', port: Number(env.SMTP_PORT || 1025) },
  mailFrom: env.MAIL_FROM || 'reservation@exemple.local',
  // Règles métier paramétrables
  delaiModificationHeures: Number(env.MODIFY_DEADLINE_HOURS || 24),
  pasCreneauMinutes: 30
};

// Refuse de démarrer avec une configuration dangereuse en production.
if (!config.jwtSecret || (enProduction && config.jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET manquant ou trop court (32 caractères minimum en production).');
}

export default config;
