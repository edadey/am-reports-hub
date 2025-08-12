module.exports = (sequelize, DataTypes) => {
  const Template = sequelize.define('Template', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    headers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    tableData: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'archived'),
      defaultValue: 'active',
    },
  }, {
    tableName: 'templates',
    timestamps: true,
    indexes: [
      {
        fields: ['name'],
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

  return Template;
};