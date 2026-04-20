require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Admin } = require('./models');

const updateAdminPassword = async () => {
  try {
    // Check if required environment variables are set
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_NAME) {
      console.error('❌ Error: Required environment variables not set:');
      console.error('   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME must be defined in .env file');
      process.exit(1);
    }

    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Hash the new password
    const newPassword = process.env.ADMIN_PASSWORD;
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the admin record (update by ID since email might have changed)
    const [updatedRows] = await Admin.update(
      {
        password: hashedPassword,
        email: process.env.ADMIN_EMAIL,
        name: process.env.ADMIN_NAME
      },
      {
        where: { admin_id: 1 } // Update the first admin record
      }
    );

    if (updatedRows > 0) {
      console.log('✅ Admin credentials updated successfully');
      console.log(`   Email: ${process.env.ADMIN_EMAIL}`);
      console.log(`   Password: ${newPassword}`);
    } else {
      console.log('❌ No admin record found to update');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Update failed:', err.message);
    process.exit(1);
  }
};

updateAdminPassword();