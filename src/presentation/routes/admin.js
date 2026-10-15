// Routes d'administration : comptes, quotas, statistiques et journal d'audit.
import { Router } from 'express';
import * as adminService from '../../services/adminService.js';
import * as auditService from '../../services/auditService.js';
import * as s from '../schemas.js';
import { asyncHandler, authentifier, contexte, exigerRole } from '../middlewares/securite.js';

const routeur = Router();
routeur.use(authentifier);

// Liste des responsables possibles pour une ressource : accessible à l'admin uniquement
routeur.get('/responsables', exigerRole('admin'), asyncHandler(async (_req, res) => res.json(await adminService.listerResponsables())));
routeur.get('/utilisateurs', exigerRole('admin'), asyncHandler(async (_req, res) => res.json(await adminService.listerUtilisateurs())));
routeur.get('/profils-quota', exigerRole('admin'), asyncHandler(async (_req, res) => res.json(await adminService.listerProfils())));

routeur.patch('/utilisateurs/:id', exigerRole('admin'), asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  res.json(await adminService.modifierUtilisateur(req.utilisateur, id, s.majUtilisateur.parse(req.body), contexte(req)));
}));

routeur.patch('/profils-quota/:id', exigerRole('admin'), asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  res.json(await adminService.modifierProfil(id, s.majProfil.parse(req.body), contexte(req)));
}));

routeur.get('/stats', exigerRole('admin'), asyncHandler(async (req, res) => {
  const { du, au } = s.intervalleJours.parse(req.query);
  res.json(await adminService.statistiques(du, au));
}));

routeur.get('/audit', exigerRole('admin'), asyncHandler(async (req, res) => {
  const f = s.filtresAudit.parse(req.query);
  res.json(await auditService.consulter({ acteurId: f.acteur_id, action: f.action, entite: f.entite, du: f.du, au: f.au, page: f.page }));
}));

export default routeur;
