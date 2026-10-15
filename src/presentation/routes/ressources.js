// Routes du catalogue des ressources et de leur calendrier d'occupation.
import { Router } from 'express';
import * as ressourceService from '../../services/ressourceService.js';
import * as reservationService from '../../services/reservationService.js';
import * as s from '../schemas.js';
import { asyncHandler, authentifier, contexte, exigerRole } from '../middlewares/securite.js';

const routeur = Router();
routeur.use(authentifier);

routeur.get('/', asyncHandler(async (req, res) => {
  const f = s.filtresRessources.parse(req.query);
  res.json(await ressourceService.lister({ type: f.type, capaciteMin: f.capacite_min, q: f.q, date: f.date }, req.utilisateur));
}));

routeur.get('/:id', asyncHandler(async (req, res) => {
  res.json(await ressourceService.obtenir(s.idParam.parse(req.params).id));
}));

// Occupation sur un intervalle : créneaux pris, sans identité des autres utilisateurs.
routeur.get('/:id/occupation', asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  const { du, au } = s.intervalle.parse(req.query);
  res.json(await reservationService.occupationRessource(id, du, au, req.utilisateur.id));
}));

routeur.post('/', exigerRole('admin'), asyncHandler(async (req, res) => {
  res.status(201).json(await ressourceService.creer(s.ressource.parse(req.body), contexte(req)));
}));

routeur.put('/:id', exigerRole('admin'), asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  res.json(await ressourceService.modifier(id, s.ressource.parse(req.body), contexte(req)));
}));

// Activation / désactivation (maintenance)
routeur.patch('/:id/activation', exigerRole('admin'), asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  const { active, motif } = s.activation.parse(req.body);
  res.json(await ressourceService.changerActivation(id, active, motif, contexte(req)));
}));

export default routeur;
