'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('colleges', 'tutorname', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (error) {
      if (!String(error?.message || '').includes('already exists')) throw error;
    }

    try {
      await queryInterface.addColumn('colleges', 'tutoremail', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (error) {
      if (!String(error?.message || '').includes('already exists')) throw error;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('colleges', 'tutorname');
    } catch (_) {}

    try {
      await queryInterface.removeColumn('colleges', 'tutoremail');
    } catch (_) {}
  },
};
