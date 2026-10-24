import prisma from '../config/prisma';
import { ReunificationStatus } from '@prisma/client';

export class ReunificationService {
  static async reportMissingPerson(data: any) {
    // Basic match check across existing checkins
    const possibleMatches = await prisma.checkin.findMany({
      where: {
        personName: {
          contains: data.missingPersonName,
          mode: 'insensitive'
        }
      },
      include: { shelter: true }
    });

    const status = possibleMatches.length > 0 ? ReunificationStatus.POTENTIAL_MATCH : ReunificationStatus.MISSING;

    const newCase = await prisma.reunificationCase.create({
      data: {
        missingPersonName: data.missingPersonName,
        age: data.age,
        gender: data.gender,
        lastKnownLocation: data.lastKnownLocation,
        contactPerson: data.contactPerson,
        contactInfo: data.contactInfo,
        description: data.description,
        status
      }
    });

    return { case: newCase, potentialMatches: possibleMatches };
  }

  static async getAllCases() {
    return prisma.reunificationCase.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  static async updateCaseStatus(id: string, status: ReunificationStatus) {
    return prisma.reunificationCase.update({
      where: { id },
      data: { status }
    });
  }
}
