module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'sessions',
    timestamps: true,
    indexes: [
      {
        fields: ['token'],
      },
      {
        fields: ['userId'],
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['expiresAt'],
      },
    ],
  });

  Session.associate = function(models) {
    Session.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  return Session;
};