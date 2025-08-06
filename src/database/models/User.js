module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'user', 'viewer'),
      defaultValue: 'user',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    accountManagerId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'AccountManagers',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['username'],
      },
      {
        fields: ['role'],
      },
    ],
  });

  User.associate = function(models) {
    User.belongsTo(models.AccountManager, {
      foreignKey: 'accountManagerId',
      as: 'accountManager',
    });
  };

  return User;
};