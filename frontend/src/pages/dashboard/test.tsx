import React from 'react';
import Head from 'next/head';

const TestDashboard: React.FC = () => {
  return (
    <>
      <Head>
        <title>Test Dashboard</title>
      </Head>
      
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-3xl font-bold mb-8">Clean Dashboard Test</h1>
        <div className="bg-gray-800 p-6 rounded-lg">
          <p>This is a test page to verify the header issue is resolved.</p>
          <p>If you see this without any header above, the caching issue is fixed.</p>
        </div>
      </div>
    </>
  );
};

export default TestDashboard;
