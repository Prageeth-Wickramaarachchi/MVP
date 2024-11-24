import { KubeConfig, CoreV1Api } from '@kubernetes/client-node';
import AWS from 'aws-sdk';

const eks = new AWS.EKS();

const handler = async (event) => {
  const email = event.request.userAttributes.email;

  // Define email to namespace map
  const emailToNamespaceMap = {
    "tenant1@gmail.com": "tenant1",
    "tenant2@gmail.com": "tenant2",
  };

  // Determine the namespace based on the email
  const namespace = emailToNamespaceMap[email] || "default";

  try {
    // Get the EKS cluster details (replace with your cluster name)
    const clusterName = 'test-k8s';
    const clusterInfo = await eks.describeCluster({ name: clusterName }).promise();

    // Extract the cluster endpoint and certificate authority
    const { endpoint, certificateAuthority } = clusterInfo.cluster;

    // Configure Kubernetes API access
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromClusterAndUser(
      {
        name: clusterName,
        server: endpoint,
        caData: certificateAuthority.data,
      },
      {
        name: 'lambda',
        token: process.env.K8S_BEARER_TOKEN, // You need to set up a K8s bearer token in Lambda env variables
      }
    );

    // Create a Kubernetes CoreV1Api client
    const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

    // Check if the namespace already exists
    try {
      await k8sApi.readNamespace(namespace);
      console.log(`Namespace '${namespace}' already exists.`);
    } catch (err) {
      if (err.response && err.response.statusCode === 404) {
        // Namespace doesn't exist, create a new one
        const namespaceManifest = {
          metadata: {
            name: namespace,
          },
        };
        await k8sApi.createNamespace(namespaceManifest);
        console.log(`Namespace '${namespace}' created successfully.`);
      } else {
        throw err;
      }
    }

  } catch (error) {
    console.error('Error creating namespace: ', error);
    throw new Error('Namespace creation failed');
  }

  return event;
};

export { handler };
