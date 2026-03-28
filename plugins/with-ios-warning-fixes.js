const { createRunOncePlugin, withPodfile, withPodfileProperties, withXcodeProject } = require('@expo/config-plugins');
const { createGeneratedHeaderComment, removeContents } = require('@expo/config-plugins/build/utils/generateCode');

const DEFAULT_IOS_DEPLOYMENT_TARGET = '18.0';
const PLUGIN_NAME = 'with-ios-warning-fixes';
const PODFILE_FIX_TAG = 'omni-bike-ios-warning-fixes';
const POD_WARNING_SUPPRESSION_FLAGS = ['-Wno-nullability-completeness', '-Wno-nonportable-include-path'];

function getDeploymentTarget(config, props) {
  return props.iosDeploymentTarget ?? config.ios?.deploymentTarget ?? DEFAULT_IOS_DEPLOYMENT_TARGET;
}

function applyPodfilePostInstallFixes(src, deploymentTarget) {
  const normalizedPlatformSrc = src.replace(
    /platform :ios, podfile_properties\['ios\.deploymentTarget'\] \|\| '[^']+'/,
    `platform :ios, podfile_properties['ios.deploymentTarget'] || '${deploymentTarget}'`,
  );

  const warningFlagsLiteral = `%w[${POD_WARNING_SUPPRESSION_FLAGS.join(' ')}]`;

  const podfileFixLines = [
    `    warning_suppression_flags = ${warningFlagsLiteral}`,
    '    ensure_warning_flags = lambda do |build_configuration, build_setting_key|',
    '      current_value = build_configuration.build_settings[build_setting_key]',
    '      flags = case current_value',
    '      when Array then current_value.dup',
    "      when String then current_value.split(' ')",
    "      when nil then ['$(inherited)']",
    '      else Array(current_value)',
    '      end',
    '',
    '      warning_suppression_flags.each do |flag|',
    '        flags << flag unless flags.include?(flag)',
    '      end',
    '',
    '      build_configuration.build_settings[build_setting_key] = flags',
    '    end',
    '',
    `    min_ios_deployment_target = podfile_properties['ios.deploymentTarget'] || '${deploymentTarget}'`,
    '    installer.pods_project.targets.each do |pod_target|',
    '      pod_target.build_configurations.each do |build_configuration|',
    "        build_configuration.build_settings['CLANG_WARN_NULLABILITY_COMPLETENESS'] = 'NO'",
    "        build_configuration.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'",
    "        build_configuration.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'",
    "        build_configuration.build_settings['SWIFT_SUPPRESS_WARNINGS'] = 'YES'",
    "        ensure_warning_flags.call(build_configuration, 'OTHER_CFLAGS')",
    "        ensure_warning_flags.call(build_configuration, 'OTHER_CPLUSPLUSFLAGS')",
    '      end',
    '    end',
    '',
    '    installer.target_installation_results.pod_target_installation_results.each_value do |pod_installation_result|',
    '      pod_installation_result.resource_bundle_targets.each do |resource_bundle_target|',
    '        resource_bundle_target.build_configurations.each do |build_configuration|',
    "          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios_deployment_target",
    "          build_configuration.build_settings['CLANG_WARN_NULLABILITY_COMPLETENESS'] = 'NO'",
    "          build_configuration.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'",
    "          build_configuration.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'",
    "          build_configuration.build_settings['SWIFT_SUPPRESS_WARNINGS'] = 'YES'",
    "          ensure_warning_flags.call(build_configuration, 'OTHER_CFLAGS')",
    "          ensure_warning_flags.call(build_configuration, 'OTHER_CPLUSPLUSFLAGS')",
    '        end',
    '      end',
    '    end',
  ];

  const fixBlock = podfileFixLines.join('\n');
  const sanitized = removeContents({ src: normalizedPlatformSrc, tag: PODFILE_FIX_TAG }).contents;
  const generatedHeader = createGeneratedHeaderComment(fixBlock, PODFILE_FIX_TAG, '#');
  const generatedBlock = `${generatedHeader}\n${fixBlock}\n# @generated end ${PODFILE_FIX_TAG}`;

  const postInstallPattern = /(post_install do \|installer\|[\s\S]*?react_native_post_install\([\s\S]*?\n\s*\))/m;

  if (!postInstallPattern.test(sanitized)) {
    throw new Error('Unable to locate the react_native_post_install block in the generated Podfile.');
  }

  return sanitized.replace(postInstallPattern, `$1\n\n${generatedBlock}`);
}

function applyProjectDeploymentTarget(config, deploymentTarget) {
  const configurations = config.modResults.pbxXCBuildConfigurationSection();

  for (const { buildSettings } of Object.values(configurations || {})) {
    if (buildSettings?.SDKROOT === 'iphoneos' || typeof buildSettings?.PRODUCT_NAME !== 'undefined') {
      buildSettings.IPHONEOS_DEPLOYMENT_TARGET = deploymentTarget;
      buildSettings.CLANG_WARN_NULLABILITY_COMPLETENESS = 'NO';
      buildSettings.CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = 'NO';
    }
  }

  return config;
}

const withIosWarningFixes = (config, props = {}) => {
  const deploymentTarget = getDeploymentTarget(config, props);

  config = withPodfileProperties(config, (config) => {
    config.modResults['ios.deploymentTarget'] = deploymentTarget;
    return config;
  });

  config = withPodfile(config, (config) => {
    config.modResults.contents = applyPodfilePostInstallFixes(config.modResults.contents, deploymentTarget);
    return config;
  });

  config = withXcodeProject(config, (config) => applyProjectDeploymentTarget(config, deploymentTarget));

  return config;
};

module.exports = createRunOncePlugin(withIosWarningFixes, PLUGIN_NAME, '1.0.0');
