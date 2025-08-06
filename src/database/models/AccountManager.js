module.exports = (sequelize, DataTypes) => {
  const AccountManager = sequelize.define('AccountManager', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    region: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'account_managers',
    timestamps: true,
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['region'],
      },
    ],
  });

  AccountManager.associate = function(models) {
    AccountManager.hasMany(models.User, {
      foreignKey: 'accountManagerId',
      as: 'users',
    });
    AccountManager.hasMany(models.College, {
      foreignKey: 'accountManagerId',
      as: 'colleges',
    });
  };

  return AccountManager;
};