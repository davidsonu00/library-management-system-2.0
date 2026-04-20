require('dotenv').config();
const { sequelize, Admin } = require('./models');

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync all models (creates tables if not exist)
    await sequelize.sync({ alter: true });
    console.log('✅ Tables synced');

    // Create default admin
    const existing = await Admin.findOne({ where: { email: process.env.ADMIN_EMAIL || 'admin@library.com' } });
    if (!existing) {
      await Admin.create({
        name: process.env.ADMIN_NAME || 'Head Librarian',
        email: process.env.ADMIN_EMAIL || 'admin@library.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
        role: 'admin'
      });
      console.log('✅ Default admin created');
      console.log(`   Email: ${process.env.ADMIN_EMAIL || 'admin@library.com'}`);
      console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);
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
