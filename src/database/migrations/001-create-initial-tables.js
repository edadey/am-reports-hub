'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create account_managers table
    await queryInterface.createTable('account_managers', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      region: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('admin', 'user', 'viewer'),
        defaultValue: 'user',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      accountManagerId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'account_managers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      lastLogin: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create colleges table
    await queryInterface.createTable('colleges', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      numberOfProviders: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      accountManagerId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'account_managers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      keyContact: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      keyStakeholder: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      superUsers: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      courses: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      placements: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create reports table
    await queryInterface.createTable('reports', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      collegeId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'colleges',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      validationChecksum: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      validationTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reportType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('draft', 'completed', 'archived'),
        defaultValue: 'completed',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create sessions table
    await queryInterface.createTable('sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      ipAddress: {
        type: Sequelize.INET,
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      lastActivityAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create security_logs table
    await queryInterface.createTable('security_logs', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      resource: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      details: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      ipAddress: {
        type: Sequelize.INET,
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      success: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Add indexes
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['username']);
    await queryInterface.addIndex('users', ['role']);
    await queryInterface.addIndex('account_managers', ['email']);
    await queryInterface.addIndex('colleges', ['name']);
    await queryInterface.addIndex('colleges', ['accountManagerId']);
    await queryInterface.addIndex('reports', ['collegeId']);
    await queryInterface.addIndex('reports', ['status']);
    await queryInterface.addIndex('reports', ['createdAt']);
    await queryInterface.addIndex('sessions', ['token']);
    await queryInterface.addIndex('sessions', ['userId']);
    await queryInterface.addIndex('sessions', ['isActive']);
    await queryInterface.addIndex('security_logs', ['userId']);
    await queryInterface.addIndex('security_logs', ['action']);
    await queryInterface.addIndex('security_logs', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('security_logs');
    await queryInterface.dropTable('sessions');
    await queryInterface.dropTable('reports');
    await queryInterface.dropTable('colleges');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('account_managers');
  }
};