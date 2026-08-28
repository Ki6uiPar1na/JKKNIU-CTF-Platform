import PlatformStatus from '../models/PlatformStatus.js';
import Contest from '../models/Contest.js';
import User from '../models/User.js';

export const seedPlatformStatus = async () => {
  const exists = await PlatformStatus.findOne({ _id: '000000000000000000000001' });
  if (!exists) {
    await PlatformStatus.create({
      _id: '000000000000000000000001',
      submission_status: 'closed',
      platform_name: 'JKKNIU CTF',
    });
  }
};

export const seedDefaultContest = async () => {
  let admin = await User.findOne({ role: { $in: [0, 2] } });
  if (!admin) {
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!defaultPassword) {
      console.error('FATAL: DEFAULT_ADMIN_PASSWORD environment variable is required to seed the admin account.');
      console.error('Set it in docker-compose.yml or .env and restart.');
      process.exit(1);
    }
    admin = await User.create({
      member_id: 0,
      full_name: 'Administrator',
      user_name: 'admin',
      email: 'admin@jkkniu.edu.bd',
      password: defaultPassword,
      role: 2,
      status: 1,
      session: '',
    });
    console.log('Default admin created (admin@jkkniu.edu.bd). Password set from environment.');
  }

  const count = await Contest.countDocuments();
  if (count === 0) {
    await Contest.create({
      title: 'JKKNIU CTF 2025',
      description: 'The inaugural JKKNIU CTF competition. Solve challenges, earn points, and prove your skills.',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      createdBy: admin._id,
    });
    console.log('Default contest created.');
  }
};
