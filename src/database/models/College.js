module.exports = (sequelize, DataTypes) => {
  const College = sequelize.define('College', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    numberOfProviders: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    accountManagerId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'AccountManagers',
        key: 'id',
      },
    },
    keyContact: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    keyStakeholder: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    superUsers: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    courses: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    placements: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    // Additional fields from file-based data
    misContact: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dataTransferMethod: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'A',
    },
    ofstedRating: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'G',
    },
    reportFrequency: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'weekly',
    },
    template: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'standard',
    },
    initialConcerns: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastReportDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    misContactName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    misContactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    renewalDate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    modules: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    keyStakeholders: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    engagementLevel: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Good',
    },
    swotStrengths: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    swotWeaknesses: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    swotOpportunities: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    swotThreats: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'colleges',
    timestamps: true,
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['accountManagerId'],
      },
      {
        fields: ['keyContact'],
      },
    ],
  });

  College.associate = function(models) {
    College.belongsTo(models.AccountManager, {
      foreignKey: 'accountManagerId',
      as: 'accountManager',
    });
    College.hasMany(models.Report, {
      foreignKey: 'collegeId',
      as: 'reports',
    });
  };

  return College;
};