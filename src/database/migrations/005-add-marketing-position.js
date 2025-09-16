'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('colleges', 'marketingposition', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {
      if (!String(e.message || '').includes('already exists')) throw e;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('colleges', 'marketingposition');
    } catch (_) {}
  }
};
