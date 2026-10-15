-- Migration 001 : schéma initial de la plateforme de réservation (PostgreSQL 16)

CREATE EXTENSION IF NOT EXISTS btree_gist; -- nécessaire pour la contrainte d'exclusion

-- Types énumérés : valeurs contrôlées par la base
CREATE TYPE role_utilisateur AS ENUM ('utilisateur', 'responsable', 'admin');
CREATE TYPE type_ressource AS ENUM ('salle', 'materiel');
CREATE TYPE statut_reservation AS ENUM ('en_attente', 'validee', 'refusee', 'terminee', 'annulee');

-- Profils de quota (un élève n'a pas les mêmes limites qu'un enseignant)
CREATE TABLE profils_quota (
    id                        SERIAL PRIMARY KEY,
    code                      VARCHAR(30)  NOT NULL UNIQUE,
    libelle                   VARCHAR(80)  NOT NULL,
    max_reservations_actives  INTEGER      NOT NULL CHECK (max_reservations_actives > 0),
    duree_max_minutes         INTEGER      NOT NULL CHECK (duree_max_minutes > 0),
    delai_max_jours           INTEGER      NOT NULL CHECK (delai_max_jours > 0)
);

CREATE TABLE utilisateurs (
    id                 SERIAL PRIMARY KEY,
    email              VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
    mot_de_passe_hash  TEXT         NOT NULL,
    prenom             VARCHAR(80)  NOT NULL,
    nom                VARCHAR(80)  NOT NULL,
    role               role_utilisateur NOT NULL DEFAULT 'utilisateur',
    profil_quota_id    INTEGER      NOT NULL REFERENCES profils_quota(id),
    actif              BOOLEAN      NOT NULL DEFAULT TRUE,
    tentatives_echec   INTEGER      NOT NULL DEFAULT 0,
    verrouille_jusqua  TIMESTAMPTZ,
    reset_token_hash   CHAR(64),
    reset_expire_le    TIMESTAMPTZ,
    cree_le            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    anonymise_le       TIMESTAMPTZ
);

CREATE TABLE ressources (
    id                      SERIAL PRIMARY KEY,
    nom                     VARCHAR(120) NOT NULL UNIQUE,
    type                    type_ressource NOT NULL,
    capacite                INTEGER      NOT NULL DEFAULT 1 CHECK (capacite >= 1),
    localisation            VARCHAR(160) NOT NULL DEFAULT '',
    equipements             TEXT[]       NOT NULL DEFAULT '{}',
    photo_url               VARCHAR(500),
    heure_ouverture         TIME         NOT NULL DEFAULT '08:00',
    heure_fermeture         TIME         NOT NULL DEFAULT '19:00',
    validation_requise      BOOLEAN      NOT NULL DEFAULT FALSE,
    responsable_id          INTEGER      REFERENCES utilisateurs(id) ON DELETE SET NULL,
    active                  BOOLEAN      NOT NULL DEFAULT TRUE,
    motif_indisponibilite   VARCHAR(200),
    cree_le                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (heure_fermeture > heure_ouverture)
);

CREATE TABLE reservations (
    id              SERIAL PRIMARY KEY,
    ressource_id    INTEGER      NOT NULL REFERENCES ressources(id) ON DELETE RESTRICT,
    utilisateur_id  INTEGER      NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
    debut           TIMESTAMPTZ  NOT NULL,
    fin             TIMESTAMPTZ  NOT NULL,
    motif           VARCHAR(300) NOT NULL DEFAULT '',
    statut          statut_reservation NOT NULL DEFAULT 'en_attente',
    motif_decision  VARCHAR(300),
    decide_par      INTEGER      REFERENCES utilisateurs(id) ON DELETE SET NULL,
    decide_le       TIMESTAMPTZ,
    rappel_envoye   BOOLEAN      NOT NULL DEFAULT FALSE,
    cree_le         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    maj_le          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    periode         TSTZRANGE GENERATED ALWAYS AS (tstzrange(debut, fin, '[)')) STORED,
    CHECK (fin > debut),
    -- Règle anti-conflit au niveau de la base : deux réservations actives
    -- ne peuvent pas se chevaucher sur la même ressource, même en accès concurrent.
    CONSTRAINT reservations_pas_de_chevauchement
        EXCLUDE USING gist (ressource_id WITH =, periode WITH &&)
        WHERE (statut IN ('en_attente', 'validee'))
);

CREATE TABLE notifications (
    id              SERIAL PRIMARY KEY,
    utilisateur_id  INTEGER      NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type            VARCHAR(40)  NOT NULL,
    message         VARCHAR(400) NOT NULL,
    lue             BOOLEAN      NOT NULL DEFAULT FALSE,
    cree_le         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes (espace perso, calendrier, tableau de bord)
CREATE INDEX idx_reservations_utilisateur ON reservations (utilisateur_id, debut);
CREATE INDEX idx_reservations_ressource   ON reservations (ressource_id, debut);
CREATE INDEX idx_reservations_statut      ON reservations (statut);
CREATE INDEX idx_notifications_user       ON notifications (utilisateur_id, lue);
CREATE INDEX idx_ressources_responsable   ON ressources (responsable_id);

-- Mise à jour automatique de la date de modification
CREATE FUNCTION maj_horodatage() RETURNS trigger AS $$
BEGIN
    NEW.maj_le = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservations_maj
    BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION maj_horodatage();

-- Données de référence : profils de quota par défaut
INSERT INTO profils_quota (code, libelle, max_reservations_actives, duree_max_minutes, delai_max_jours) VALUES
    ('eleve',      'Élève',      3,  120, 14),
    ('personnel',  'Personnel',  5,  240, 30),
    ('enseignant', 'Enseignant', 10, 480, 60);
