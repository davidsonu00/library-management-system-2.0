require('dotenv').config();
const { sequelize } = require('./models');

const fixTimestamps = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Fix members table
    await sequelize.query(`
      UPDATE members
      SET createdAt = NOW(), updatedAt = NOW()
      WHERE createdAt = '0000-00-00 00:00:00' OR createdAt IS NULL
    `);
    console.log('✅ Fixed members timestamps');

    // Fix books table
    await sequelize.query(`
      UPDATE books
      SET createdAt = NOW(), updatedAt = NOW()
      WHERE createdAt = '0000-00-00 00:00:00' OR createdAt IS NULL
    `);
    console.log('✅ Fixed books timestamps');

    // Fix issue_log table
    await sequelize.query(`
      UPDATE issue_log
      SET createdAt = NOW(), updatedAt = NOW()
      WHERE createdAt = '0000-00-00 00:00:00' OR createdAt IS NULL
    `);
    console.log('✅ Fixed issue_log timestamps');

    console.log('🎉 Timestamp fix complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Fix failed:', err.message);
    process.exit(1);
  }
};

fixTimestamps();
