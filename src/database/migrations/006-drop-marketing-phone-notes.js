'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop legacy columns marketingphone and marketingnotes
    try {
      await queryInterface.removeColumn('colleges', 'marketingphone');
    } catch (e) {
      // ignore if doesn't exist
    }
    try {
      await queryInterface.removeColumn('colleges', 'marketingnotes');
    } catch (e) {
      // ignore if doesn't exist
    }
  },

  async down(queryInterface, Sequelize) {
    // Recreate columns if needed on rollback
    try {
      await queryInterface.addColumn('colleges', 'marketingphone', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (_) {}
    try {
      await queryInterface.addColumn('colleges', 'marketingnotes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    } catch (_) {}
  }
};
