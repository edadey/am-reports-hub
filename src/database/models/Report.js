module.exports = (sequelize, DataTypes) => {
  const Report = sequelize.define('Report', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    collegeId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'Colleges',
        key: 'id',
      },
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    validationChecksum: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    validationTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reportType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'completed', 'archived'),
      defaultValue: 'completed',
    },
  }, {
    tableName: 'reports',
    timestamps: true,
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['collegeId'],
      },
      {
        fields: ['createdBy'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdAt'],
      },
    ],
  });

  Report.associate = function(models) {
    Report.belongsTo(models.College, {
      foreignKey: 'collegeId',
      as: 'college',
    });
  };

  return Report;
};