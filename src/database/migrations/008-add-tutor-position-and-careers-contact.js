"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const addColumn = async (columnName) => {
      try {
        await queryInterface.addColumn("colleges", columnName, {
          type: Sequelize.STRING,
          allowNull: true,
        });
      } catch (error) {
        if (!String(error?.message || "").includes("already exists")) {
          throw error;
        }
      }
    };

    await addColumn("tutorposition");
    await addColumn("careerscontactname");
    await addColumn("careerscontactposition");
    await addColumn("careerscontactemail");
  },

  async down(queryInterface) {
    const removeColumn = async (columnName) => {
      try {
        await queryInterface.removeColumn("colleges", columnName);
      } catch (_) {
        // ignore
      }
    };

    await removeColumn("tutorposition");
    await removeColumn("careerscontactname");
    await removeColumn("careerscontactposition");
    await removeColumn("careerscontactemail");
  },
};
