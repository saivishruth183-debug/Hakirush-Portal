import React from "react";
import { Link } from "react-router-dom";

const Unauthorized = () => {
  return (
    <div className="flex flex-col items-center justify-center mt-50 ">
      <h1 className="text-6xl font-bold mb-5">403 - Unauthorized</h1>
      <p className="text-md text-red-600 mb-5">You do not have permission to view this page.</p>

      <Link to="/login" className="bg-red-600 px-6 py-2 text-white rounded-lg">
        Go to Login
      </Link>
    </div>
  );
};

export default Unauthorized;
