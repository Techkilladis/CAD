import prisma from '../config/prisma';

export class VolunteerService {
  static async createShift(data: { shelterId: string; startTime: Date; endTime: Date; requiredCount: number }) {
    if (data.startTime >= data.endTime) {
      throw { statusCode: 400, message: 'End time must be after start time' };
    }
    return prisma.volunteerShift.create({ data });
  }

  static async getShifts(shelterId?: string) {
    const where = shelterId ? { shelterId } : {};
    return prisma.volunteerShift.findMany({
      where,
      include: {
        shelter: true,
        assignments: {
          include: { volunteer: true }
        }
      },
      orderBy: { startTime: 'asc' }
    });
  }

  static async signUpForShift(shiftId: string, volunteerId: string) {
    return prisma.$transaction(async (tx) => {
      const shift = await tx.volunteerShift.findUnique({
        where: { id: shiftId },
        include: { assignments: true }
      });
      if (!shift) throw { statusCode: 404, message: 'Shift not found' };

      if (shift.assignments.length >= shift.requiredCount) {
        throw { statusCode: 400, message: 'Shift is already full' };
      }

      const existingAssignment = await tx.volunteerAssignment.findUnique({
        where: { shiftId_volunteerId: { shiftId, volunteerId } }
      });

      if (existingAssignment) {
        throw { statusCode: 400, message: 'Already signed up for this shift' };
      }

      // Conflict prevention (no overlapping shifts)
      const userAssignments = await tx.volunteerAssignment.findMany({
        where: { volunteerId },
        include: { shift: true }
      });

      for (const assignment of userAssignments) {
        if (shift.startTime < assignment.shift.endTime && shift.endTime > assignment.shift.startTime) {
          throw { statusCode: 400, message: 'Time conflict with an existing shift' };
        }
      }

      return tx.volunteerAssignment.create({
        data: { shiftId, volunteerId }
      });
    });
  }

  static async cancelSignup(shiftId: string, volunteerId: string) {
    return prisma.volunteerAssignment.delete({
      where: { shiftId_volunteerId: { shiftId, volunteerId } }
    }).catch(() => {
      throw { statusCode: 400, message: 'Assignment not found' };
    });
  }
}
