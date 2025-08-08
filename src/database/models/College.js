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
    // Additional fields from file-based data (PostgreSQL converts to lowercase)
    miscontact: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'miscontact', // explicitly specify the database column name
    },
    datatransfermethod: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'datatransfermethod',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'A',
    },
    ofstedrating: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'G',
      field: 'ofstedrating',
    },
    reportfrequency: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'weekly',
      field: 'reportfrequency',
    },
    template: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'standard',
    },
    initialconcerns: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'initialconcerns',
    },
    lastreportdate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'lastreportdate',
    },
    miscontactname: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'miscontactname',
    },
    miscontactemail: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'miscontactemail',
    },
    renewaldate: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'renewaldate',
    },
    modules: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    keystakeholders: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'keystakeholders',
    },
    engagementlevel: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Good',
      field: 'engagementlevel',
    },
    swotstrengths: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'swotstrengths',
    },
    swotweaknesses: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'swotweaknesses',
    },
    swotopportunities: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'swotopportunities',
    },
    swotthreats: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'swotthreats',
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