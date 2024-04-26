module.exports = function (sequelize, Sequalize) {
  var Backup = sequelize.define(
    "Backup",
    {
      wallet_address: Sequalize.STRING,
      private_key: Sequalize.STRING,
    },
    {
      timestamps: false,
    }
  );
  Backup.associate = function (models) {
    // associations can be defined here
  };
  return Backup;
};
