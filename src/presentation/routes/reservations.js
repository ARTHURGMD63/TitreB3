// Routes des réservations (utilisateur) et de leur validation (responsable).
import { Router } from 'express';
import * as reservationService from '../../services/reservationService.js';
import * as s from '../schemas.js';
import { asyncHandler, authentifier, contexte, exigerRole } from '../middlewares/securite.js';

const routeur = Router();
routeur.use(authentifier);

routeur.get('/mes', asyncHandler(async (req, res) => {
  const { periode } = s.periodeReservations.parse(req.query);
  res.json(await reservationService.mesReservations(req.utilisateur, periode));
}));

routeur.post('/', asyncHandler(async (req, res) => {
  const reservation = await reservationService.creer(req.utilisateur, s.reservation.parse(req.body), contexte(req));
  res.status(201).json(reservation);
}));

routeur.put('/:id', asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  res.json(await reservationService.modifier(req.utilisateur, id, s.modificationReservation.parse(req.body), contexte(req)));
}));

routeur.post('/:id/annuler', asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  res.json(await reservationService.annuler(req.utilisateur, id, contexte(req)));
}));

// --- Espace du responsable ---
routeur.get('/a-traiter', exigerRole('responsable', 'admin'), asyncHandler(async (req, res) => {
  res.json(await reservationService.demandesATraiter(req.utilisateur));
}));

routeur.get('/planning', exigerRole('responsable', 'admin'), asyncHandler(async (req, res) => {
  const { du, au } = s.intervalle.parse(req.query);
  res.json(await reservationService.planning(req.utilisateur, du, au));
}));

routeur.post('/:id/decision', exigerRole('responsable', 'admin'), asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  res.json(await reservationService.decider(req.utilisateur, id, s.decision.parse(req.body), contexte(req)));
}));

export default routeur;
