import { Request, Response, NextFunction } from 'express';
import { ShelterService } from '../services/shelter.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import prisma from '../config/prisma';

export const getShelters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shelters = await ShelterService.getAllShelters();
    res.json(shelters);
  } catch (error) {
    next(error);
  }
};

export const getNearestShelters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    const shelters = await ShelterService.getNearestShelters(parseFloat(latitude as string), parseFloat(longitude as string));
    res.json(shelters);
  } catch (error) {
    next(error);
  }
};

export const getShelterById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shelter = await ShelterService.getShelterById(req.params.id);
    if (!shelter) return res.status(404).json({ error: 'Shelter not found' });
    res.json(shelter);
  } catch (error) {
    next(error);
  }
};

export const createShelter = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const shelter = await ShelterService.createShelter(req.body);
    res.status(201).json(shelter);
  } catch (error) {
    next(error);
  }
};

const verifyShelterCoordinator = async (req: AuthenticatedRequest, shelterId: string) => {
  if (req.user?.role === 'ADMIN') return null; // Admin can do anything
  const shelter = await prisma.shelter.findUnique({ where: { id: shelterId } });
  if (!shelter) return { status: 404, message: 'Shelter not found' };
  if (shelter.coordinatorId !== req.user?.id) return { status: 403, message: 'Forbidden: You do not manage this shelter' };
  return null;
};

export const updateShelter = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authErr = await verifyShelterCoordinator(req, req.params.id);
    if (authErr) return res.status(authErr.status).json({ error: authErr.message });

    const shelter = await ShelterService.updateShelter(req.params.id, req.body);
    res.json(shelter);
  } catch (error) {
    next(error);
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ShelterService.register(req.params.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const confirmCheckin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authErr = await verifyShelterCoordinator(req, req.params.id);
    if (authErr) return res.status(authErr.status).json({ error: authErr.message });

    const result = await ShelterService.confirmCheckin(req.params.id, req.params.checkinId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const checkIn = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authErr = await verifyShelterCoordinator(req, req.params.id);
    if (authErr) return res.status(authErr.status).json({ error: authErr.message });

    const result = await ShelterService.checkIn(req.params.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const checkOut = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authErr = await verifyShelterCoordinator(req, req.params.id);
    if (authErr) return res.status(authErr.status).json({ error: authErr.message });

    const { checkinId, familySize } = req.body;
    const result = await ShelterService.checkOut(req.params.id, checkinId, familySize);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getResources = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resources = await ShelterService.getResources(req.params.id);
    res.json(resources);
  } catch (error) {
    next(error);
  }
};

export const updateResource = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authErr = await verifyShelterCoordinator(req, req.params.id);
    if (authErr) return res.status(authErr.status).json({ error: authErr.message });

    const result = await ShelterService.updateResource(req.params.id, req.params.resourceId, req.body.quantity);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
