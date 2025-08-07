'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('colleges', 'misContact', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'dataTransferMethod', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'status', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'A',
    });

    await queryInterface.addColumn('colleges', 'ofstedRating', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'G',
    });

    await queryInterface.addColumn('colleges', 'reportFrequency', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'weekly',
    });

    await queryInterface.addColumn('colleges', 'template', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'standard',
    });

    await queryInterface.addColumn('colleges', 'initialConcerns', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'lastReportDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'misContactName', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'misContactEmail', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'renewalDate', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'modules', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn('colleges', 'keyStakeholders', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn('colleges', 'engagementLevel', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'Good',
    });

    await queryInterface.addColumn('colleges', 'swotStrengths', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'swotWeaknesses', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'swotOpportunities', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('colleges', 'swotThreats', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('colleges', 'misContact');
    await queryInterface.removeColumn('colleges', 'dataTransferMethod');
    await queryInterface.removeColumn('colleges', 'status');
    await queryInterface.removeColumn('colleges', 'ofstedRating');
    await queryInterface.removeColumn('colleges', 'reportFrequency');
    await queryInterface.removeColumn('colleges', 'template');
    await queryInterface.removeColumn('colleges', 'initialConcerns');
    await queryInterface.removeColumn('colleges', 'lastReportDate');
    await queryInterface.removeColumn('colleges', 'misContactName');
    await queryInterface.removeColumn('colleges', 'misContactEmail');
    await queryInterface.removeColumn('colleges', 'renewalDate');
    await queryInterface.removeColumn('colleges', 'modules');
    await queryInterface.removeColumn('colleges', 'keyStakeholders');
    await queryInterface.removeColumn('colleges', 'engagementLevel');
    await queryInterface.removeColumn('colleges', 'swotStrengths');
    await queryInterface.removeColumn('colleges', 'swotWeaknesses');
    await queryInterface.removeColumn('colleges', 'swotOpportunities');
    await queryInterface.removeColumn('colleges', 'swotThreats');
  }
};
