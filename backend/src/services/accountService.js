const fs = require("fs/promises");
const path = require("path");
const { ROLES } = require("../constants/roles");
const Alert = require("../models/Alert");
const Device = require("../models/Device");
const DoctorPatient = require("../models/DoctorPatient");
const Reading = require("../models/Reading");
const User = require("../models/User");

const removeDoctorVerificationDocument = async (documentFileName) => {
  if (!documentFileName) {
    return;
  }

  const { doctorVerificationDir } = require("../middlewares/upload");
  const safeName = path.basename(documentFileName);

  try {
    await fs.unlink(path.join(doctorVerificationDir, safeName));
  } catch (_error) {}
};

const deleteUserAccount = async (user) => {
  if (!user) {
    return null;
  }

  const userId = user._id;

  const cleanupOperations = [
    Alert.updateMany(
      { acknowledgedBy: userId },
      { $set: { acknowledgedBy: null } }
    ),
    User.updateMany(
      { "doctorVerification.reviewedBy": userId },
      { $unset: { "doctorVerification.reviewedBy": "" } }
    ),
  ];

  if (user.role === ROLES.PATIENT) {
    cleanupOperations.push(
      Alert.deleteMany({ patient: userId }),
      Reading.deleteMany({ patient: userId }),
      DoctorPatient.deleteMany({ patient: userId }),
      Device.updateMany(
        { patient: userId },
        {
          $set: {
            patient: null,
            lastSeenAt: null,
          },
          $unset: {
            label: "",
          },
        }
      )
    );
  }

  if (user.role === ROLES.DOCTOR) {
    cleanupOperations.push(DoctorPatient.deleteMany({ doctor: userId }));
  }

  await Promise.all(cleanupOperations);
  await user.deleteOne();
  await removeDoctorVerificationDocument(user.doctorVerification?.documentFileName);

  return user;
};

module.exports = {
  deleteUserAccount,
};
