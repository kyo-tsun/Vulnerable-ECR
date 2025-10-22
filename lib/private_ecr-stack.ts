import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecrdeploy from 'cdk-ecr-deployment';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import { RemovalPolicy } from 'aws-cdk-lib';

export class PrivateEcrStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECRリポジトリを作成
    const repository = new ecr.Repository(this, 'VulnerableAppRepo', {
      repositoryName: 'vulnerable-app',
      removalPolicy: RemovalPolicy.DESTROY
    });

    // すべてのアカウントからのアクセスを許可
    repository.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: [
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:BatchCheckLayerAvailability',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload'
      ]
    }));

    // Dockerイメージをビルド
    const image = new DockerImageAsset(this, 'VulnerableAppImage', {
      directory: './app',
      platform: Platform.LINUX_AMD64
    });

    // ビルドしたイメージをECRにデプロイ
    new ecrdeploy.ECRDeployment(this, 'DeployVulnerableAppImage', {
      src: new ecrdeploy.DockerImageName(image.imageUri),
      dest: new ecrdeploy.DockerImageName(repository.repositoryUri + ':latest')
    });

    // AppRunnerサービス
    const appRunnerService = new apprunner.Service(this, 'VulnerableAppService', {
      source: apprunner.Source.fromEcr({
        imageConfiguration: {
          port: 8080
        },
        repository,
        tagOrDigest: 'latest'
      }),
      autoDeploymentsEnabled: true
    });

    // ECRリポジトリURIを出力
    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri
    });

    // AppRunnerのデフォルトドメインを出力
    new cdk.CfnOutput(this, 'AppRunnerUrl', {
      value: `https://${appRunnerService.serviceUrl}`
    });
  }
}