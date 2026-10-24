import { PrismaClient, Prisma, ResourceType, ShelterStatus, TransferStatus, ReunificationStatus } from '@prisma/client';
import { computeMedicalPriority } from '../src/utils/medicalPriority';
import { AlertService } from '../src/services/alert.service';

// Chennai demo data. Run with `npx prisma db seed` (dev DB from backend/.env only).
const prisma = new PrismaClient();

const hours = (h: number) => new Date(Date.now() + h * 3600_000);
const days = (d: number) => hours(d * 24);

async function audit(userId: string | null, action: string, entity: string, entityId: string, metadata: Prisma.InputJsonValue = {}) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, metadata } });
}

async function main() {
  if (!/safehaven/.test(process.env.DATABASE_URL ?? '')) throw new Error('DATABASE_URL not set');
  console.log('Clearing old data...');
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`
  );

  // ---------- Users ----------
  const mk = (name: string, email: string, role: any, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { name, email, role, ...extra } });
  const admin1 = await mk('Anitha Rajan (Admin)', 'anitha@safehaven.local', 'ADMIN', { phone: '+91 44 2500 1001' });
  const admin2 = await mk('Suresh Babu (Admin)', 'suresh@safehaven.local', 'ADMIN', { phone: '+91 44 2500 1002' });
  const priya = await mk('Priya Venkatesh', 'priya@safehaven.local', 'COORDINATOR', { phone: '+91 98400 11111' });
  const karthik = await mk('Karthik Subramanian', 'karthik@safehaven.local', 'COORDINATOR', { phone: '+91 98400 22222' });
  const meena = await mk('Meena Krishnan', 'meena@safehaven.local', 'COORDINATOR', { phone: '+91 98400 33333' });
  const vol1 = await mk('Divya Lakshmi', 'divya@safehaven.local', 'VOLUNTEER', { phone: '+91 90030 44444', skills: 'First aid, Tamil/English', languages: 'ta,en' });
  const vol2 = await mk('Arun Kumar', 'arun@safehaven.local', 'VOLUNTEER', { phone: '+91 90030 55555', skills: 'Logistics, driving', languages: 'ta,en,hi' });
  const vol3 = await mk('Fatima Begum', 'fatima@safehaven.local', 'VOLUNTEER', { phone: '+91 90030 66666', skills: 'Counselling, cooking', languages: 'ta,ur,en' });

  // ---------- Shelters ----------
  type S = {
    key: string; name: string; address: string; lat: number; lng: number; cap: number; occ: number;
    coord: string; status: ShelterStatus; medical: boolean; desc: string; phone: string;
    ta: { name: string; description: string; instructions: string };
    res: Record<ResourceType, [number, number, string]>; // qty, threshold, unit
  };
  const defs: S[] = [
    {
      key: 'velachery', name: 'Velachery Community Hall', address: '45 Taramani Link Rd, Velachery, Chennai 600042',
      lat: 12.9815, lng: 80.2180, cap: 100, occ: 45, coord: priya.id, status: 'ACTIVE', medical: true,
      desc: 'Large community hall on higher ground with a first-aid room. Family-friendly.', phone: '+91 44 2243 0101',
      ta: { name: 'வேளச்சேரி சமுதாயக் கூடம்', description: 'மேடான பகுதியில் உள்ள பெரிய சமுதாயக் கூடம். முதலுதவி அறை உள்ளது.', instructions: 'குடும்ப விவரங்களுடன் முன்பதிவு செய்து, குறியீட்டை வரவேற்பில் காட்டவும்.' },
      res: { FOOD: [900, 200, 'meal packs'], WATER: [1500, 300, 'litres'], MEDICINE: [220, 40, 'kits'], BLANKETS: [160, 30, 'pieces'] },
    },
    {
      key: 'tambaram', name: 'Tambaram Relief School', address: '12 GST Road, East Tambaram, Chennai 600059',
      lat: 12.9249, lng: 80.1275, cap: 60, occ: 55, coord: priya.id, status: 'ACTIVE', medical: false,
      desc: 'Government school converted to a relief camp. Classrooms used as family rooms.', phone: '+91 44 2239 0202',
      ta: { name: 'தாம்பரம் நிவாரணப் பள்ளி', description: 'நிவாரண முகாமாக மாற்றப்பட்ட அரசுப் பள்ளி.', instructions: 'வகுப்பறைகள் குடும்பங்களுக்கு ஒதுக்கப்படும்.' },
      res: { FOOD: [260, 120, 'meal packs'], WATER: [420, 150, 'litres'], MEDICINE: [30, 20, 'kits'], BLANKETS: [70, 25, 'pieces'] },
    },
    {
      key: 'mudichur', name: 'Mudichur Flood Camp', address: 'Varadharajapuram Main Rd, Mudichur, Chennai 600048',
      lat: 12.9024, lng: 80.0714, cap: 40, occ: 40, coord: meena.id, status: 'FULL', medical: false,
      desc: 'Temporary camp near the Adyar river banks. Currently at full capacity.', phone: '+91 44 2275 0303',
      ta: { name: 'முடிச்சூர் வெள்ள முகாம்', description: 'அடையாறு ஆற்றங்கரை அருகே தற்காலிக முகாம். தற்போது நிரம்பியுள்ளது.', instructions: 'நிரம்பியுள்ளது – தாம்பரம் அல்லது வேளச்சேரியைத் தொடர்பு கொள்ளவும்.' },
      res: { FOOD: [150, 100, 'meal packs'], WATER: [300, 120, 'litres'], MEDICINE: [45, 20, 'kits'], BLANKETS: [50, 30, 'pieces'] },
    },
    {
      key: 'adyar', name: 'Adyar Corporation Shelter', address: '8 Gandhi Nagar 1st Main Rd, Adyar, Chennai 600020',
      lat: 13.0067, lng: 80.2570, cap: 80, occ: 30, coord: karthik.id, status: 'ACTIVE', medical: true,
      desc: 'Corporation-run shelter with a visiting doctor. Medicine stock is running low.', phone: '+91 44 2441 0404',
      ta: { name: 'அடையாறு மாநகராட்சி தங்குமிடம்', description: 'மருத்துவர் வருகை தரும் மாநகராட்சி தங்குமிடம். மருந்து இருப்பு குறைவு.', instructions: 'மருத்துவ தேவை உள்ளவர்கள் வரவேற்பில் தெரிவிக்கவும்.' },
      res: { FOOD: [500, 150, 'meal packs'], WATER: [800, 200, 'litres'], MEDICINE: [12, 40, 'kits'], BLANKETS: [100, 30, 'pieces'] },
    },
    {
      key: 'tnagar', name: 'T. Nagar Marriage Hall', address: '27 Usman Road, T. Nagar, Chennai 600017',
      lat: 13.0418, lng: 80.2341, cap: 120, occ: 0, coord: meena.id, status: 'INACTIVE', medical: false,
      desc: 'Standby shelter, not currently activated.', phone: '+91 44 2434 0505',
      ta: { name: 'தி. நகர் திருமண மண்டபம்', description: 'தயார்நிலை தங்குமிடம்; தற்போது செயல்படவில்லை.', instructions: 'செயல்படுத்தப்படும் வரை காத்திருக்கவும்.' },
      res: { FOOD: [0, 100, 'meal packs'], WATER: [200, 100, 'litres'], MEDICINE: [20, 20, 'kits'], BLANKETS: [200, 40, 'pieces'] },
    },
    {
      key: 'perungudi', name: 'Perungudi Panchayat Hall', address: 'Kandanchavadi, Perungudi, Chennai 600096',
      lat: 12.9654, lng: 80.2461, cap: 70, occ: 0, coord: karthik.id, status: 'EMERGENCY_CLOSED', medical: false,
      desc: 'Closed after waterlogging in the building. Do not travel here.', phone: '+91 44 2496 0606',
      ta: { name: 'பெருங்குடி பஞ்சாயத்து மண்டபம்', description: 'கட்டிடத்தில் நீர் தேங்கியதால் மூடப்பட்டுள்ளது.', instructions: 'இங்கு வர வேண்டாம்.' },
      res: { FOOD: [80, 50, 'meal packs'], WATER: [100, 60, 'litres'], MEDICINE: [10, 10, 'kits'], BLANKETS: [40, 20, 'pieces'] },
    },
  ];

  const shelters: Record<string, { id: string; coord: string }> = {};
  const resources: Record<string, Record<ResourceType, string>> = {};
  for (const d of defs) {
    const s = await prisma.shelter.create({
      data: {
        name: d.name, address: d.address, latitude: d.lat, longitude: d.lng,
        capacityTotal: d.cap, capacityOccupied: 0, coordinatorId: d.coord, status: d.status,
        description: d.desc, contactInfo: 'Shelter front desk', contactPhone: d.phone,
        contactEmail: `${d.key}@safehaven.local`, medicalSupport: d.medical,
        translations: {
          create: [
            { locale: 'en', name: d.name, description: d.desc, instructions: 'Register your family online, then show the reference code at the front desk.' },
            { locale: 'ta', ...d.ta },
          ],
        },
      },
    });
    shelters[d.key] = { id: s.id, coord: d.coord };
    resources[d.key] = {} as Record<ResourceType, string>;
    await audit(admin1.id, 'SHELTER_CREATE', 'Shelter', s.id, { name: d.name });
    for (const type of Object.keys(d.res) as ResourceType[]) {
      const [qty, thr, unit] = d.res[type];
      const r = await prisma.resource.create({ data: { shelterId: s.id, resourceType: type, quantity: qty, lowStockThreshold: thr, unit } });
      resources[d.key][type] = r.id;
      await prisma.stockMovement.create({
        data: { resourceId: r.id, shelterId: s.id, type: 'SET', delta: qty, quantityAfter: qty, note: 'Opening stock', userId: d.coord, createdAt: days(-3) },
      });
    }
  }

  // ---------- Families / check-ins (occupancy computed from confirmed rows) ----------
  const first = ['Murugan', 'Lakshmi', 'Selvam', 'Kavitha', 'Ramesh', 'Meenakshi', 'Senthil', 'Revathi', 'Gopal', 'Saraswathi', 'Vijay', 'Anjali', 'Prakash', 'Deepa', 'Mohan', 'Sumathi', 'Ibrahim', 'Rukmini', 'Dinesh', 'Janaki', 'Balaji', 'Nirmala', 'Sekar', 'Pushpa', 'Ganesh', 'Thenmozhi', 'Raja', 'Vasantha', 'Anand', 'Kalaivani', 'Suriya', 'Mythili', 'Hari', 'Bhuvana', 'Karim', 'Chitra', 'Manoj', 'Geetha', 'Ashok', 'Sangeetha'];
  const last = ['Family', 'Household'];
  let nameIdx = 0;
  const flagsCycle = [
    {}, {}, { elderlyCount: 1 }, { childrenCount: 2 }, {}, { medicalFlag: true, medicalNotes: 'Diabetic – needs insulin cold storage' },
    { pregnantFlag: true }, {}, { disabledFlag: true, emergencyNotes: 'Wheelchair user' }, { childrenCount: 1, elderlyCount: 1 },
    {}, { criticalMedical: true, medicalFlag: true, medicalNotes: 'Dialysis patient – urgent' }, {},
  ] as any[];
  let flagIdx = 0;
  let phoneN = 9000;

  for (const d of defs) {
    let remaining = d.occ;
    const sId = shelters[d.key].id;
    // The Adyar shelter hosts the critical case; skip it elsewhere so the demo story is clear.
    while (remaining > 0) {
      const size = Math.min(remaining, 2 + ((nameIdx * 7) % 5));
      let flags = { ...flagsCycle[flagIdx++ % flagsCycle.length] };
      if (flags.criticalMedical && d.key !== 'adyar') flags = { medicalFlag: true, medicalNotes: flags.medicalNotes };
      const kids = Math.min(flags.childrenCount ?? 0, size);
      const elder = Math.min(flags.elderlyCount ?? 0, size);
      const person = `${first[nameIdx % first.length]} ${last[nameIdx % 2]}`;
      const c = await prisma.checkin.create({
        data: {
          shelterId: sId, personName: person, familySize: size, phone: `+91 9${String(phoneN++).padStart(9, '0')}`,
          medicalFlag: !!flags.medicalFlag, criticalMedical: !!flags.criticalMedical, elderlyCount: elder,
          pregnantFlag: !!flags.pregnantFlag, disabledFlag: !!flags.disabledFlag, childrenCount: kids,
          emergencyNotes: flags.emergencyNotes ?? null, medicalNotes: flags.medicalNotes ?? null,
          priority: computeMedicalPriority({ ...flags, elderlyCount: elder, childrenCount: kids }),
          status: 'CONFIRMED', source: 'COORDINATOR', checkedInById: shelters[d.key].coord,
          confirmedAt: days(-2), checkedInAt: days(-2), createdAt: days(-2),
        },
      });
      await audit(shelters[d.key].coord, 'CHECKIN', 'Checkin', c.id, { shelterId: sId, familySize: size });
      remaining -= size;
      nameIdx++;
    }
    const confirmed = await prisma.checkin.aggregate({ where: { shelterId: sId, status: 'CONFIRMED' }, _sum: { familySize: true } });
    await prisma.shelter.update({ where: { id: sId }, data: { capacityOccupied: confirmed._sum.familySize ?? 0 } });
  }

  // A couple of checked-out families for history, and 3 pending public registrations.
  const histCheckin = await prisma.checkin.create({
    data: {
      shelterId: shelters.velachery.id, personName: 'Palani Family', familySize: 4, status: 'CHECKED_OUT', source: 'COORDINATOR',
      checkedInById: priya.id, checkedOutById: priya.id, confirmedAt: days(-3), checkedInAt: days(-3), checkedOutAt: days(-1),
    },
  });
  await audit(priya.id, 'CHECKOUT', 'Checkin', histCheckin.id, { shelterId: shelters.velachery.id, familySize: 4 });
  const pendingDefs = [
    ['Thangavel Family', 3, 'velachery', { elderlyCount: 1 }],
    ['Roja Household', 2, 'velachery', { pregnantFlag: true }],
    ['Nazeer Family', 5, 'tambaram', { childrenCount: 3 }],
  ] as const;
  const codes = ['SH-DEMO01', 'SH-DEMO02', 'SH-DEMO03'];
  for (let i = 0; i < pendingDefs.length; i++) {
    const [name, size, key, flags] = pendingDefs[i];
    const c = await prisma.checkin.create({
      data: {
        shelterId: shelters[key].id, personName: name, familySize: size, status: 'PENDING', source: 'PUBLIC_REGISTRATION',
        referenceCode: codes[i], phone: `+91 9${String(phoneN++).padStart(9, '0')}`,
        elderlyCount: (flags as any).elderlyCount ?? 0, childrenCount: (flags as any).childrenCount ?? 0,
        pregnantFlag: !!(flags as any).pregnantFlag,
        priority: computeMedicalPriority(flags as any),
      },
    });
    await audit(null, 'CHECKIN_REGISTER', 'Checkin', c.id, { referenceCode: codes[i] });
  }

  // ---------- Transfers in every status (inventory kept consistent) ----------
  async function stockMove(shelterKey: string, type: ResourceType, delta: number, mvType: any, note: string, userId: string, referenceId: string) {
    const rid = resources[shelterKey][type];
    const r = await prisma.resource.update({ where: { id: rid }, data: { quantity: { increment: delta } } });
    await prisma.stockMovement.create({ data: { resourceId: rid, shelterId: shelters[shelterKey].id, type: mvType, delta, quantityAfter: r.quantity, note, userId, referenceId } });
  }
  const T = (from: string, to: string, type: ResourceType, qty: number, status: TransferStatus, requester: string, extra: Prisma.TransferUncheckedCreateInput | any = {}) =>
    prisma.transfer.create({ data: { fromShelterId: shelters[from].id, toShelterId: shelters[to].id, resourceType: type, quantity: qty, status, requestedById: requester, reason: 'Stock rebalancing', ...extra } });

  // Pending: Adyar (low medicine) requests from Velachery (surplus)
  const t1 = await T('velachery', 'adyar', 'MEDICINE', 60, 'PENDING', karthik.id, { reason: 'Adyar medicine kits critically low; dialysis patient on site' });
  await audit(karthik.id, 'TRANSFER_REQUEST', 'Transfer', t1.id, { quantity: 60 });
  // Approved (deducted from source)
  const t2 = await T('velachery', 'tambaram', 'FOOD', 80, 'APPROVED', priya.id, { approvedById: admin1.id, approvedAt: days(-0.5) });
  await stockMove('velachery', 'FOOD', -80, 'TRANSFER_OUT', 'Transfer approved', admin1.id, t2.id);
  await audit(admin1.id, 'TRANSFER_APPROVE', 'Transfer', t2.id, { quantity: 80 });
  // In transit
  const t3 = await T('adyar', 'mudichur', 'WATER', 100, 'IN_TRANSIT', meena.id, { approvedById: admin2.id, approvedAt: days(-1), shippedAt: hours(-6) });
  await stockMove('adyar', 'WATER', -100, 'TRANSFER_OUT', 'Transfer approved', admin2.id, t3.id);
  await audit(admin2.id, 'TRANSFER_APPROVE', 'Transfer', t3.id, {});
  // Received
  const t4 = await T('velachery', 'mudichur', 'BLANKETS', 30, 'RECEIVED', karthik.id, { approvedById: admin1.id, approvedAt: days(-2), shippedAt: days(-2), receivedAt: days(-1.5), receivedById: meena.id });
  await stockMove('velachery', 'BLANKETS', -30, 'TRANSFER_OUT', 'Transfer approved', admin1.id, t4.id);
  await stockMove('mudichur', 'BLANKETS', 30, 'TRANSFER_IN', 'Transfer received', meena.id, t4.id);
  // Rejected
  const t5 = await T('adyar', 'tambaram', 'FOOD', 400, 'REJECTED', priya.id, { approvedById: admin2.id, rejectionReason: 'Adyar needs its own food stock this week' });
  await audit(admin2.id, 'TRANSFER_REJECT', 'Transfer', t5.id, {});
  // Cancelled before approval (nothing deducted)
  await T('tambaram', 'adyar', 'WATER', 50, 'CANCELLED', karthik.id, { cancelledAt: days(-1), cancelledById: karthik.id });

  // ---------- Volunteer shifts ----------
  const shift = (key: string, title: string, task: string, startH: number, durH: number, need: number, creator: string, status: any = 'OPEN') =>
    prisma.volunteerShift.create({
      data: { shelterId: shelters[key].id, title, task, startTime: hours(startH), endTime: hours(startH + durH), requiredCount: need, createdById: creator, status },
    });
  const past = await shift('velachery', 'Morning registration desk', 'Registration', -30, 4, 2, priya.id);
  const s1 = await shift('velachery', 'Evening meal service', 'Food distribution', 20, 4, 3, priya.id);
  const s2 = await shift('velachery', 'Medical help desk', 'First aid support', 21, 4, 2, priya.id); // overlaps s1 by 3h
  const s3 = await shift('tambaram', 'Night watch', 'Safety & crowd management', 28, 6, 1, priya.id); // full
  await shift('adyar', 'Medicine inventory support', 'Logistics', 40, 3, 2, karthik.id);
  await shift('mudichur', 'Counselling circle', 'Counselling', 48, 2, 2, meena.id, 'CANCELLED');
  const assign = (shiftId: string, volunteerId: string) => prisma.volunteerAssignment.create({ data: { shiftId, volunteerId } });
  await assign(past.id, vol1.id);
  await assign(s1.id, vol1.id);
  await assign(s2.id, vol3.id);
  await assign(s3.id, vol2.id);

  // ---------- Donations ----------
  const don = async (key: string, donor: string, type: ResourceType, qty: number, unit: string, status: any, applied: boolean, recorder: string, notes: string) => {
    const d = await prisma.donation.create({
      data: {
        shelterId: shelters[key].id, donorName: donor, resourceType: type, quantity: qty, unit, status, inventoryApplied: applied,
        recordedById: recorder, acceptedById: status === 'ACCEPTED' ? recorder : null, acceptedAt: status === 'ACCEPTED' ? days(-1) : null,
        notes, receiptRef: `RCPT-${Math.floor(1000 + Math.random() * 9000)}`, receivedDate: days(-1),
      },
    });
    if (applied) await stockMove(key, type, qty, 'DONATION', `Donation from ${donor}`, recorder, d.id);
    return d;
  };
  await don('velachery', 'Chennai Rotary Club', 'FOOD', 200, 'meal packs', 'ACCEPTED', true, priya.id, 'Cooked meals, delivered at noon');
  await don('tambaram', 'Sri Sai Trust', 'WATER', 300, 'litres', 'ACCEPTED', true, priya.id, 'Packaged drinking water');
  await don('adyar', 'Apollo Pharmacy Volunteers', 'MEDICINE', 25, 'kits', 'PENDING', false, karthik.id, 'Awaiting expiry check before accepting');
  await don('adyar', 'Local Residents Association', 'BLANKETS', 40, 'pieces', 'ACCEPTED', true, karthik.id, '');
  await don('mudichur', 'Anonymous', 'FOOD', 50, 'meal packs', 'PENDING', false, meena.id, 'Dropped at gate');
  await don('velachery', 'IIT Madras Alumni', 'MEDICINE', 40, 'kits', 'ACCEPTED', true, priya.id, 'Sealed first-aid kits');
  await don('tambaram', 'Corporate CSR Fund', 'BLANKETS', 80, 'pieces', 'REJECTED', false, priya.id, 'Items were damaged');
  await don('mudichur', 'Madhavan Foundation', 'WATER', 120, 'litres', 'PENDING', false, meena.id, '');

  // ---------- Reunification cases ----------
  const rc = (data: any) => prisma.reunificationCase.create({ data });
  const someone = await prisma.checkin.findFirst({ where: { shelterId: shelters.tambaram.id, status: 'CONFIRMED' } });
  await rc({ missingPersonName: 'Lakshmi Narayanan', age: 72, gender: 'Female', lastKnownLocation: 'Velachery bus depot', lastKnownShelterId: shelters.velachery.id, contactPerson: 'Narayanan R', contactInfo: '+91 98400 70001', description: 'Wears a green saree, uses a walking stick', status: 'MISSING' as ReunificationStatus });
  await rc({ missingPersonName: 'Arjun Prasad', age: 9, gender: 'Male', lastKnownLocation: 'Mudichur bridge', contactPerson: 'Prasad S', contactInfo: '+91 98400 70002', description: 'Blue school uniform, answers to Arju', status: 'MISSING' as ReunificationStatus });
  await rc({ missingPersonName: someone?.personName.split(' ')[0] ?? 'Selvam', age: 41, gender: 'Male', lastKnownLocation: 'East Tambaram', lastKnownShelterId: shelters.tambaram.id, contactPerson: 'Kamala D', contactInfo: '+91 98400 70003', status: 'POTENTIAL_MATCH' as ReunificationStatus, matchedCheckinId: someone?.id ?? null, staffNotes: 'Possible match with a family registered at Tambaram. Awaiting ID confirmation.' });
  await rc({ missingPersonName: 'Fathima Rahman', age: 29, gender: 'Female', lastKnownLocation: 'Adyar', lastKnownShelterId: shelters.adyar.id, contactPerson: 'Rahman A', contactInfo: '+91 98400 70004', status: 'REUNITED' as ReunificationStatus, staffNotes: 'Reunited at Adyar shelter front desk.' });
  await rc({ missingPersonName: 'Baby of Revathi', age: 1, gender: 'Female', lastKnownLocation: 'T. Nagar', contactPerson: 'Revathi K', contactInfo: '+91 98400 70005', status: 'CLOSED' as ReunificationStatus, staffNotes: 'Found safe with relatives; case closed.' });
  await rc({ missingPersonName: 'Gopinath Iyer', age: 66, gender: 'Male', lastKnownLocation: 'Perungudi', lastKnownShelterId: shelters.perungudi.id, contactPerson: 'Iyer M', contactInfo: '+91 98400 70006', status: 'MISSING' as ReunificationStatus });

  // ---------- Settings (defaults, explicit so Admin → Settings shows them) ----------
  for (const [key, value] of Object.entries({ overcrowdingThreshold: '0.9', criticalMedicalCount: '5', transferSurplusMultiplier: '3', alertScanIntervalMs: '0' })) {
    await prisma.systemSetting.create({ data: { key, value, updatedById: admin1.id } });
  }

  // ---------- Alerts: real engine run + a few historical rows ----------
  const result = await AlertService.runGlobalCheck();
  console.log('Alert engine:', result);
  await prisma.alertLog.create({
    data: { shelterId: shelters.tambaram.id, alertType: 'LOW_STOCK', severity: 'WARNING', status: 'RESOLVED', message: 'WATER was low at Tambaram Relief School (resolved after donation).', resourceType: 'WATER', dedupeKey: `LOW_STOCK:${shelters.tambaram.id}:WATER`, triggeredAt: days(-2), resolvedAt: days(-1), resolvedById: priya.id, notifiedVia: 'LOCAL' },
  });
  await prisma.alertLog.create({
    data: { shelterId: shelters.velachery.id, alertType: 'OVERCROWDING', severity: 'WARNING', status: 'ACKNOWLEDGED', acknowledged: true, message: 'Velachery Community Hall reached 91% earlier today.', dedupeKey: `HIST:OVERCROWDING:${shelters.velachery.id}`, triggeredAt: days(-1), acknowledgedAt: days(-1), acknowledgedById: priya.id, notifiedVia: 'LOCAL' },
  });

  const counts = {
    shelters: await prisma.shelter.count(), checkins: await prisma.checkin.count(), alerts: await prisma.alertLog.count({ where: { status: 'ACTIVE' } }),
  };
  console.log('Seed complete:', counts);
  void vol2; void admin2;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
