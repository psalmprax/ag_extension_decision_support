import { describe, it, expect } from 'vitest';
import { LABEL_CONDITIONS, labelDisplayName, matchCrop, isHealthyLabel, modelCrops } from '@/services/edgeModelLabels';

describe('on-device model labels', () => {
  it('names labels in plain words, with maize for the training data\'s "corn"', () => {
    expect(labelDisplayName('bean___rust')).toBe('Bean rust');
    expect(labelDisplayName('corn___streak_virus')).toBe('Maize streak virus');
    expect(labelDisplayName('banana___fusarium_wilt')).toBe('Banana Fusarium wilt');
    expect(labelDisplayName('corn___healthy')).toBe('Healthy maize leaf');
    expect(labelDisplayName('tomato___healthy_fruit')).toBe('Healthy tomato fruit');
    expect(labelDisplayName('date_palm___parlatoria_scale')).toBe('Date palm Parlatoria scale');
    expect(labelDisplayName('orange___zinc_deficiency')).toBe('Orange zinc deficiency');
  });

  it('knows a healthy label', () => {
    expect(isHealthyLabel('coffee___healthy')).toBe(true);
    expect(isHealthyLabel('coffee___leaf_rust')).toBe(false);
  });

  it('matches the crop the person typed to one the model knows', () => {
    const crops = modelCrops(['corn___rust', 'bean___rust', 'soybean___healthy', 'cowpea___rust', 'coffee___leaf_rust']);
    expect(matchCrop('Maize', crops)).toBe('corn');
    expect(matchCrop('my beans', crops)).toBe('bean');
    expect(matchCrop('Soybeans', crops)).toBe('soybean');
    expect(matchCrop('cowpea', crops)).toBe('cowpea');
    expect(matchCrop('Rice', crops)).toBeNull();
    const peppers = modelCrops(['pepper___rust', 'chili___cercospora', 'bell_pepper___healthy', 'rice___blast', 'eggplant___wilt']);
    expect(matchCrop('Bell pepper', peppers)).toBe('bell_pepper');
    expect(matchCrop('chilli', peppers)).toBe('chili');
    expect(matchCrop('hot pepper', peppers)).toBe('chili');
    expect(matchCrop('pepper', peppers)).toBe('pepper');
    expect(matchCrop('paddy field', peppers)).toBe('rice');
    expect(matchCrop('brinjal', peppers)).toBe('eggplant');
    expect(matchCrop('', crops)).toBeNull();
  });

  it('matches a label to a known condition only when crop and disease both match', () => {
    expect(LABEL_CONDITIONS.cassava___mosaic).toBe('Cassava Mosaic Disease (CMD)');
    expect(LABEL_CONDITIONS.banana___xanthomonas_wilt).toBe('Banana Xanthomonas Wilt (BXW)');
    // Not every bean or coffee problem is angular leaf spot or leaf rust.
    expect(LABEL_CONDITIONS.bean___rust).toBeUndefined();
    expect(LABEL_CONDITIONS.coffee___leaf_miner).toBeUndefined();
    // Maize "rust" and "leaf blight" do not say which pathogen.
    expect(LABEL_CONDITIONS.corn___rust).toBeUndefined();
    expect(LABEL_CONDITIONS.corn___leaf_blight).toBeUndefined();
  });
});
