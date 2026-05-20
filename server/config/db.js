const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Export models as db.X for backward-compatible usage across controllers
const User         = require('../models/User');
const Subject      = require('../models/Subject');
const Chapter      = require('../models/Chapter');
const File         = require('../models/File');
const Result       = require('../models/Result');
const Broadcast    = require('../models/Broadcast');
const Message      = require('../models/Message');
const Notification = require('../models/Notification');
const Bookmark     = require('../models/Bookmark');
const Setting      = require('../models/Setting');

// Compatibility shim — wraps Mongoose models to match NeDB API used in controllers
function makeShim(Model) {
  return {
    // find(query).sort(s).limit(n) — returns a Mongoose Query (chainable)
    find: (query = {}) => Model.find(fixQuery(query)),

    findOne: (query = {}) => Model.findOne(fixQuery(query)),

    insert: (doc) => Model.create(doc),

    update: async (query, update, options = {}) => {
      const q = fixQuery(query);
      if (options.multi) {
        return Model.updateMany(q, update);
      }
      // If update has no $ operators, treat as full replace via save()
      if (!hasOperators(update)) {
        const doc = await Model.findOne(q);
        if (doc) { Object.assign(doc, update); return doc.save(); }
        return null;
      }
      return Model.findOneAndUpdate(q, update, { new: true });
    },

    remove: async (query, options = {}) => {
      const q = fixQuery(query);
      if (options.multi) return Model.deleteMany(q);
      return Model.findOneAndDelete(q);
    },

    count: (query = {}) => Model.countDocuments(fixQuery(query)),

    ensureIndex: () => {} // no-op, indexes defined in schema
  };
}

// Convert NeDB string _id queries to MongoDB ObjectId queries
function fixQuery(query) {
  if (!query || typeof query !== 'object') return query;
  const fixed = {};
  for (const [k, v] of Object.entries(query)) {
    if (k === '_id' || k.endsWith('Id') || k === 'from' || k === 'to' || k === 'userId' || k === 'uploadedBy' || k === 'owner' || k === 'createdBy') {
      if (typeof v === 'string' && v.length === 24) {
        fixed[k] = new mongoose.Types.ObjectId(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof mongoose.Types.ObjectId)) {
        // Handle operators like { $ne: id }, { $exists: bool }
        const inner = {};
        for (const [op, val] of Object.entries(v)) {
          if (typeof val === 'string' && val.length === 24) {
            inner[op] = new mongoose.Types.ObjectId(val);
          } else {
            inner[op] = val;
          }
        }
        fixed[k] = inner;
      } else {
        fixed[k] = v;
      }
    } else if (k === '$or' && Array.isArray(v)) {
      fixed[k] = v.map(fixQuery);
    } else {
      fixed[k] = v;
    }
  }
  return fixed;
}

function hasOperators(obj) {
  return obj && typeof obj === 'object' && Object.keys(obj).some(k => k.startsWith('$'));
}

// db.X interface — same as before in all controllers
const db = {
  users:         makeShim(User),
  subjects:      makeShim(Subject),
  chapters:      makeShim(Chapter),
  files:         makeShim(File),
  results:       makeShim(Result),
  broadcasts:    makeShim(Broadcast),
  messages:      makeShim(Message),
  notifications: makeShim(Notification),
  bookmarks:     makeShim(Bookmark),
  settings:      makeShim(Setting),
  connect:       connectDB
};

module.exports = db;
