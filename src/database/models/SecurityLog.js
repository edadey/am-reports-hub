module.exports = (sequelize, DataTypes) => {
  const SecurityLog = sequelize.define('SecurityLog', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    resource: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    success: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'security_logs',
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['action'],
      },
      {
        fields: ['success'],
      },
      {
        fields: ['createdAt'],
      },
      {
        fields: ['ipAddress'],
      },
    ],
  });

  SecurityLog.associate = function(models) {
    SecurityLog.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  return SecurityLog;
};