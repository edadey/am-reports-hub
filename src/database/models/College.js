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