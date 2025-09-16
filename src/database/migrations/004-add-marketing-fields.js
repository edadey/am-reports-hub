'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add marketing contact fields to colleges table
    try {
      await queryInterface.addColumn('colleges', 'marketingname', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {
      if (!String(e.message || '').includes('already exists')) throw e;
    }

    try {
      await queryInterface.addColumn('colleges', 'marketingemail', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {
      if (!String(e.message || '').includes('already exists')) throw e;
    }

    try {
      await queryInterface.addColumn('colleges', 'marketingphone', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {
      if (!String(e.message || '').includes('already exists')) throw e;
    }

    try {
      await queryInterface.addColumn('colleges', 'marketingnotes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    } catch (e) {
      if (!String(e.message || '').includes('already exists')) throw e;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('colleges', 'marketingname');
    } catch (_) {}
    try {
      await queryInterface.removeColumn('colleges', 'marketingemail');
    } catch (_) {}
    try {
      await queryInterface.removeColumn('colleges', 'marketingphone');
    } catch (_) {}
    try {
      await queryInterface.removeColumn('colleges', 'marketingnotes');
    } catch (_) {}
  }
};
