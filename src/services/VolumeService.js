const fs = require("fs-extra");
const path = require("path");

class VolumeService {
  constructor() {
    // Use environment variable for volume path, fallback to Railway default
    this.volumePath = process.env.VOLUME_PATH || "/data";
    this.localDataPath = path.join(__dirname, "../../data");
    this.isVolumeMounted = false;
  }

  /**
   * Initialize volume service
   */
  async initialize() {
    try {
      console.log("🔄 Initializing VolumeService...");
      console.log("📁 Volume path:", this.volumePath);
      console.log("📁 Local data path:", this.localDataPath);
      console.log("🌍 Environment:", process.env.NODE_ENV || 'development');
      
      // Check if Railway volume is mounted
      this.isVolumeMounted = await fs.pathExists(this.volumePath);
      
      if (this.isVolumeMounted) {
        console.log("✅ Railway volume mounted at:", this.volumePath);
        
        // Ensure volume has required directories
        await this.ensureVolumeStructure();
        
        // Migrate data from local to volume if needed
        await this.migrateDataToVolume();
      } else {
        console.log("⚠️ Railway volume not mounted, using local storage at:", this.localDataPath);
        // Create local data directory as fallback
        await fs.ensureDir(this.localDataPath);
      }
      
      console.log("✅ VolumeService initialized successfully");
      console.log("📊 Current data path:", this.getDataPath());
      
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize volume service:", error);
      return false;
    }
  }

  /**
   * Ensure volume has required directory structure
   */
  async ensureVolumeStructure() {
    const directories = [
      "reports",
      "analytics", 
      "templates",
      "uploads",
      "ai-cache"
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.volumePath, dir);
      await fs.ensureDir(dirPath);
    }
    
    console.log("✅ Volume directory structure ensured");
  }

  /**
   * Migrate data from local storage to volume
   */
  async migrateDataToVolume() {
    try {
      if (!await fs.pathExists(this.localDataPath)) {
        return; // No local data to migrate
      }

      const files = await fs.readdir(this.localDataPath);
      
      for (const file of files) {
        const localPath = path.join(this.localDataPath, file);
        const volumePath = path.join(this.volumePath, file);
        
        const stat = await fs.stat(localPath);
        
        if (stat.isFile()) {
          // Migrate file
          if (!(await fs.pathExists(volumePath))) {
            await fs.copy(localPath, volumePath);
            console.log(`📁 Migrated file: ${file}`);
          }
        } else if (stat.isDirectory()) {
          // Migrate directory
          if (!(await fs.pathExists(volumePath))) {
            await fs.copy(localPath, volumePath);
            console.log(`📁 Migrated directory: ${file}`);
          }
        }
      }
      
      console.log("✅ Data migration completed");
    } catch (error) {
      console.error("❌ Data migration failed:", error);
    }
  }

  /**
   * Get the appropriate data path (volume or local)
   */
  getDataPath() {
    return this.isVolumeMounted ? this.volumePath : this.localDataPath;
  }

  /**
   * Read file from volume or local storage
   */
  async readFile(filePath) {
    const fullPath = path.join(this.getDataPath(), filePath);
    return await fs.readJson(fullPath);
  }

  /**
   * Write file to volume or local storage
   */
  async writeFile(filePath, data) {
    const fullPath = path.join(this.getDataPath(), filePath);
    await fs.ensureDir(path.dirname(fullPath));
    return await fs.writeJson(fullPath, data, { spaces: 2 });
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    const fullPath = path.join(this.getDataPath(), filePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * List files in directory
   */
  async listFiles(dirPath) {
    const fullPath = path.join(this.getDataPath(), dirPath);
    if (await fs.pathExists(fullPath)) {
      return await fs.readdir(fullPath);
    }
    return [];
  }

  /**
   * Get volume status
   */
  getStatus() {
    return {
      isVolumeMounted: this.isVolumeMounted,
      volumePath: this.volumePath,
      localDataPath: this.localDataPath,
      currentDataPath: this.getDataPath()
    };
  }
}

module.exports = VolumeService;
