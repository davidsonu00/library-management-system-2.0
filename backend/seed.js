require('dotenv').config();
const { sequelize, Admin } = require('./models');

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync all models (creates tables if not exist)
    // await sequelize.sync({ alter: true });
    console.log('✅ Tables already created via schema.sql');

    // Create default admin
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME;

    if (!adminEmail || !adminPassword || !adminName) {
      throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME must be set in environment variables');
    }

    const existing = await Admin.findOne({ where: { email: adminEmail } });
    if (!existing) {
      await Admin.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
      });
      console.log('✅ Default admin created');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    } else {
      console.log('ℹ️  Admin already exists, skipping');
    }

    console.log('\n🎉 Setup complete! Run: npm run dev');
    process.exit(0);
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
};

seed();
