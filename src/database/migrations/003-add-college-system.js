'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('colleges', 'collegesystem', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (error) {
      // Idempotent: ignore if already exists
      if (!String(error.message || '').includes('already exists')) {
        throw error;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('colleges', 'collegesystem');
    } catch (error) {
      // Ignore if column missing
    }
  }
};


